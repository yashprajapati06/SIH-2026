"""Bounded, read-only contracts for the public-data knowledge assistant."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

State = Literal["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"]


class ChatQuery(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    message: str = Field(min_length=1, max_length=1000)
    language: Literal["auto", "en", "hinglish"] = "auto"
    state: State | None = None
    source: Literal["auto", "inventory", "reports", "guidance"] = "auto"
    # Only previous user questions are context, never client-supplied answers.
    previous_questions: list[str] = Field(default_factory=list, max_length=4)


class Citation(BaseModel):
    id: str
    kind: Literal["inventory", "report", "guidance", "dataset"]
    title: str
    detail: str
    url: str


class ChatAnswer(BaseModel):
    answer: str
    status: Literal["answered", "no_evidence", "limited"]
    language: Literal["en", "hinglish"]
    mode: Literal["local_retrieval"] = "local_retrieval"
    snapshot_date: str = "2026-09-08"
    matched_records: int = 0
    citations: list[Citation] = Field(default_factory=list)
    breakdown: list[dict] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    scope: str = "Public historical inventory, study catalogue and reviewed guidance"
    notes: list[str] = Field(default_factory=list)
