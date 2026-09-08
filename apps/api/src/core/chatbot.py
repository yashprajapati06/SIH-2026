"""Deterministic retrieval over an explicit public corpus; no model/key/DB needed.

Documents are data, never executable instructions. No private repository stores,
external URLs supplied by users, cloud providers or operational writes are used.
"""
from collections import Counter, defaultdict
from functools import lru_cache
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import re

from src.schemas.chatbot import ChatAnswer, ChatQuery, Citation

STATES = ("Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura")
ALIASES = {"arunachal": "Arunachal Pradesh", "अरुणाचल प्रदेश": "Arunachal Pradesh",
           "असम": "Assam", "मणिपुर": "Manipur", "मेघालय": "Meghalaya", "मिजोरम": "Mizoram",
           "नागालैंड": "Nagaland", "सिक्किम": "Sikkim", "त्रिपुरा": "Tripura"}
SNAPSHOT_URL = "https://github.com/yashprajapati06/SIH-2026/blob/data/northeast-validation/data/gsi/README.md"
CATALOGUE_URL = "https://bhusanket.gsi.gov.in/statewiseLandslideReport.html"
STOP = set("a an the of in on at to and or is are was were has have had me my i we you your it its that this these those "
           "please show tell give find search explain about for from with by how many much which where what when all any "
           "can could would do does did be as land landslide landslides slide slides historical history inventory "
           "record records event events data northeast north east india state states district districts "
           "total count number compare comparison most highest more top list details detail information info "
           "report reports study studies catalogue catalog gsi bhusanket pdf references reference "
           "mein mai me ke ki ka ko se hai he hain h kya kitne kitna bata batao do dikhao mujhe aur sab zyada jyada "
           "hue hui hua huye hogi hoti hota hain hote baare bare wala wali per par yeh ye yaha waha "
           "near around there same also then about available recorded check".split())


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s/-]", " ", text.casefold())).strip()


def tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[^\W_]+", normalize(text)) if t not in STOP}


def phrase(text: str, value: str) -> bool:
    return bool(re.search(r"(?<!\w)" + re.escape(normalize(value)) + r"(?!\w)", normalize(text)))


class KnowledgeBase:
    def __init__(self, directory: Path):
        raw = gzip.decompress((directory / "northeast_inventory.json.gz").read_bytes())
        if hashlib.sha256(raw).hexdigest() != "1f3e261371264dfabe3694811f6e9886d4950443e3d752289b6f9933d493665d":
            raise ValueError("Unrecognized inventory snapshot; review its provenance before indexing")
        self.inventory = json.loads(raw)["records"]
        self.reports = json.loads((directory / "report_catalogue.json").read_text(encoding="utf-8"))["reports"]
        self.articles = json.loads((directory / "knowledge.json").read_text(encoding="utf-8"))["articles"]
        self.districts = sorted({r["district"] for r in self.inventory if r["district"]}, key=len, reverse=True)
        self.docs = []
        self.postings = defaultdict(set)
        for kind, rows in (("inventory", self.inventory), ("report", self.reports)):
            for row in rows:
                # Whitelist content fields; no arbitrary server files enter the corpus.
                fields = ("state", "district", "slide_no", "slide_name", "road_or_location", "material_involved", "movement_type", "history_raw") if kind == "inventory" else ("project_title", "state_scope", "project_type", "accession_no", "field_season_raw")
                terms = tokens(" ".join(str(row.get(k, "")) for k in fields))
                index = len(self.docs)
                self.docs.append((kind, row, terms))
                for token in terms:
                    self.postings[token].add(index)

    def coverage(self) -> dict:
        return {"inventory_records": len(self.inventory), "study_references": len(self.reports),
                "guidance_articles": len(self.articles), "states": list(STATES), "snapshot_date": "2026-09-08",
                "flagged_coordinates": sum(not r["coordinate_valid"] for r in self.inventory),
                "mode": "local_retrieval", "live_data": False, "source_url": SNAPSHOT_URL}

    def locations(self, question: str) -> tuple[list[str], list[str]]:
        states = [s for s in STATES if phrase(question, s)]
        states += [s for alias, s in ALIASES.items() if phrase(question, alias) and s not in states]
        districts = [d for d in self.districts if phrase(question, d)]
        return states, districts

    @staticmethod
    def dataset_citation() -> Citation:
        return Citation(id="gsi-snapshot", kind="dataset", title="GSI Northeast historical snapshot",
                        detail="11,022 extracted rows; snapshot checked 8 September 2026. Includes source page references and two coordinate flags.", url=SNAPSHOT_URL)

    def article_answer(self, article_id: str, language: str, status="answered") -> ChatAnswer:
        article = next(a for a in self.articles if a["id"] == article_id)
        return ChatAnswer(answer=article[language], status=status, language=language,
                          citations=[Citation(id=article["id"], kind="guidance", title=article["title"],
                                              detail="Reviewed summary · 8 September 2026", url=article["url"])],
                          suggestions=["How many landslide records are in Assam?", "Find GSI studies for Sikkim"])

    def answer(self, request: ChatQuery) -> ChatAnswer:
        question = normalize(request.message)
        language = request.language
        if language == "auto":
            language = "hinglish" if re.search(r"[\u0900-\u097f]|\b(kya|kaise|kitne|kitna|mein|mai|batao|bata|kyu|kyun|hai|hoo|he|mujhe)\b", question) else "en"
        hi = language == "hinglish"
        states, districts = self.locations(question)
        # An explicitly selected state limits retrieval, even when the text names another state.
        if request.state and states and request.state not in states:
            return ChatAnswer(answer=("Question aur selected state alag hain. State filter badal kar dobara poochho." if hi else "Your question names a different state from the selected filter. Change the state filter and ask again."), status="no_evidence", language=language)
        states = [request.state] if request.state else states
        followup = bool(re.search(r"\b(there|same|these|those|waha|us|iska|isme|their)\b", question))
        if not states and not districts and followup:
            for previous in reversed(request.previous_questions):
                states, districts = self.locations(previous[:1000])
                if states or districts:
                    break
        topics = tokens(question)

        # Safety advice precedes catalogue/statistical retrieval, even with a place name.
        if any(phrase(question, p) for p in ("emergency", "stuck", "happening", "landslide hui", "kya karu", "kya kare", "bachao", "सुरक्षा", "बचाव")):
            return self.article_answer("safety", language, "limited")
        educational = bool(re.search(r"\b(how|why|what|explain|kaise|kyu|kyun|kya)\b", question))
        statistical = bool(re.search(r"\b(count|total|many|kitne|kitna|most|highest|compare|comparison)\b", question))
        live = bool(re.search(r"\b(today|tonight|tomorrow|currently|current|live|latest|now|aaj|abhi|kal|forecast|prediction|probability)\b", question))
        if live and not (educational and not states and not districts):
            return ChatAnswer(answer=("Mere paas is jagah ki live condition ya future landslide confirm karne ka data nahi hai. Historical records current safety ka proof nahi hain. Current alerts ke liye official SACHET aur district authority check karo." if hi else "I cannot confirm current conditions or predict a landslide here. These are historical records, not evidence that an area is safe now. Check official SACHET alerts and your district authority for current information."),
                status="limited", language=language, citations=[self.dataset_citation(), Citation(id="sachet", kind="guidance", title="Official SACHET alerts", detail="External portal; live alerts have not been fetched by this assistant.", url="https://sachet.ndma.gov.in/")], suggestions=["Show historical landslides in Assam"])

        # General questions are answered from reviewed articles, never from fixture forecasts.
        general = not states and not districts and request.source not in ("inventory", "reports")
        if general and educational and not statistical and any(phrase(question, p) for p in ("dataset", "data", "source", "csv", "json")):
            article = "model" if any(phrase(question, p) for p in ("model", "ai", "train", "training", "prediction")) else "data"
            return self.article_answer(article, language)
        if request.source == "guidance" or (general and educational and not statistical):
            scored = sorted(((len(topics & tokens(a["keywords"])), a["id"]) for a in self.articles), reverse=True)
            if scored[0][0] > 0:
                return self.article_answer(scored[0][1], language)
            if "landslide" in question or "भूस्खलन" in question:
                # Only broad definition questions default to basics; unknown qualifiers must not disappear.
                if not topics or topics <= {"definition", "meaning", "hota", "भूस्खलन", "क्या", "है"}:
                    return self.article_answer("basics", language)
        report_request = request.source == "reports" or (request.source == "auto" and bool(re.search(r"\b(study|studies|catalogue|catalog|pdf|reports|report)\b", question)))
        if any(phrase(question, p) for p in ("soil", "slope angle", "drainage", "permeability", "model", "training", "train model", "ai", "risk score", "risk")) and not report_request:
            return self.article_answer("model", language, "limited")
        if question in ("hi", "hello", "hey", "namaste", "help", "what can you do"):
            return self.article_answer("data", language)

        kind = "report" if report_request else "inventory"
        residual = question
        for location in states + districts + [a for a, s in ALIASES.items() if s in states]:
            residual = re.sub(r"(?<!\w)" + re.escape(normalize(location)) + r"(?!\w)", " ", residual)
        terms = tokens(residual)
        ranking = bool(re.search(r"\b(most|highest|top|compare|comparison|zyada|jyada)\b", question))
        # Remove only routing words, not unknown locations or search qualifiers.
        terms -= {"than", "versus", "vs", "occurred", "occur", "happened", "number", "landslides", "landslide"}
        history_years = re.findall(r"\b(?:19|20)\d{2}\b", question) if "/" not in question and kind == "inventory" else []
        candidates = set(range(len(self.docs)))
        for term in terms:
            candidates &= self.postings.get(term, set())
        matches = []
        for index in candidates:
            doc_kind, row, doc_terms = self.docs[index]
            if doc_kind != kind:
                continue
            if history_years and not all(phrase(str(row.get("history_raw", "")), year) for year in history_years):
                continue
            region = row.get("state", row.get("state_scope", ""))
            if states and not any(phrase(region, state) for state in states):
                continue
            if districts:
                location_text = row.get("district", "") if kind == "inventory" else row["project_title"]
                if not any(phrase(location_text, district) for district in districts):
                    continue
            score = sum(math.log(1 + len(self.docs) / (1 + len(self.postings[t]))) for t in terms if t in doc_terms)
            matches.append((score, index, row))
        matches.sort(key=lambda item: (-item[0], item[1]))
        if not matches or (not terms and not states and not districts and not any(phrase(question, p) for p in ("landslide", "landslides", "inventory", "data", "records", "reports", "study", "studies", "state", "states", "district", "districts"))):
            # Keyword-matched guidance is useful for short topic-only questions.
            if general and topics:
                scored = sorted(((len(topics & tokens(a["keywords"])), a["id"]) for a in self.articles), reverse=True)
                if scored[0][0] and topics <= set().union(*(tokens(a["keywords"]) for a in self.articles)):
                    return self.article_answer(scored[0][1], language)
            return ChatAnswer(answer=("Available knowledge mein is question ka matching evidence nahi mila. State, district, road ya slide ID likho, ya question ko thoda specific karo. Match na milna landslide na hone ka proof nahi hai." if hi else "I could not find matching evidence in the available knowledge. Try a state, district, road, slide ID or a more specific question. No matching record does not mean no landslides occurred."), status="no_evidence", language=language,
                suggestions=["Assam landslide records", "GSI studies for Meghalaya", "Why do landslides happen?"])

        count = len(matches)
        location = ", ".join(districts or states) or "Northeast India"
        label = "study references" if kind == "report" else "historical inventory rows"
        answer = (f"{location}: {count:,} matching {label} mile. Neeche source records hain." if hi else f"I found {count:,} matching {label} for {location}. Supporting records are shown below.")
        breakdown = []
        if kind == "inventory" and (ranking or (not terms and not districts and not states)):
            by_district = bool(states) or bool(re.search(r"\bdistricts?\b", question))
            counts = Counter((f"{r['district']} ({r['state']})" if by_district else r["state"]) for _, _, r in matches)
            breakdown = [{"label": name, "count": n} for name, n in sorted(counts.items(), key=lambda c: (-c[1], c[0]))[:10]]
            if ranking:
                answer += (f" Is matching set mein sabse zyada rows {breakdown[0]['label']} ki hain ({breakdown[0]['count']:,})." if hi else f" Within these matches, {breakdown[0]['label']} has the most rows ({breakdown[0]['count']:,}).")
        citations = [self.dataset_citation()]
        for _, _, row in matches[:5]:
            if kind == "inventory":
                coords = f"{row['latitude']}, {row['longitude']}" if row["coordinate_valid"] else "flagged / unavailable; do not map"
                detail = (f"{row['district']}, {row['state']} · Location: {row['road_or_location']} · "
                          f"Material: {row['material_involved']} · Movement: {row['movement_type']} · "
                          f"History as published: {row['history_raw']} · Coordinates: {coords} · "
                          f"landslide_report.pdf, page {row['source_pdf_page']}, serial {row['inventory_serial_no']}")
                citations.append(Citation(id=f"gsi-{row['inventory_serial_no']}", kind="inventory", title=f"{row['slide_name']} — {row['slide_no']}", detail=detail, url=SNAPSHOT_URL))
            else:
                url = row["report_url"]
                if not url.startswith("https://bhusanket.gsi.gov.in/Output/LandslideReport/"):
                    url = CATALOGUE_URL
                citations.append(Citation(id=f"study-{row['catalog_serial_no']}", kind="report", title=row["project_title"],
                    detail=f"{row['project_type']} · {row['state_scope']} · Field season: {row['field_season_raw']} · Accession {row['accession_no']} · Catalogue metadata only; full PDF text is not indexed.", url=url))
        notes = ["Counts describe this snapshot's rows, not a complete event census or a future-risk ranking.",
                 "Historical dates may be missing, approximate or describe multiple events. A year search matches the published history text."] if kind == "inventory" else ["Study references are not landslide events. Report links are catalogue references; remote PDF availability has not been verified for this query."]
        if count > 5:
            notes.append(f"Showing 5 of {count:,} matches. Narrow the question to a district, road, slide ID or year for more specific records.")
        return ChatAnswer(answer=answer, status="answered", language=language, matched_records=count,
            citations=citations, breakdown=breakdown, notes=notes,
            suggestions=[f"Find GSI studies for {states[0] if states else 'Sikkim'}", "What data does the model need?"])


@lru_cache(maxsize=1)
def get_knowledge_base() -> KnowledgeBase:
    configured = os.environ.get("CHATBOT_DATA_DIR")
    if configured:
        directory = Path(configured)
    else:
        # Works from any cwd in a checkout; Docker supplies CHATBOT_DATA_DIR.
        directory = next((p / "data/gsi" for p in Path(__file__).resolve().parents if (p / "data/gsi/knowledge.json").is_file()), None)
    if directory is None:
        raise FileNotFoundError("Chatbot knowledge data is not configured")
    return KnowledgeBase(directory)
