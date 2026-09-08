"""Authenticated public-reference search, available to every active account."""
from fastapi import APIRouter, Depends, Request

from src.core.chatbot import get_knowledge_base
from src.core.errors import SentinelAPIException
from src.core.security.dependencies import get_current_user
from src.core.security.rate_limiter import check_rate_limit
from src.schemas.chatbot import ChatAnswer, ChatQuery
from src.schemas.common import APIResponse

router = APIRouter(prefix="/chatbot", tags=["Landslide knowledge assistant"])


def knowledge():
    try:
        return get_knowledge_base()
    except (OSError, ValueError, KeyError):
        raise SentinelAPIException(message="The knowledge dataset is unavailable. Please try again after it has been restored.", code="ERR_KNOWLEDGE_UNAVAILABLE", status_code=503) from None


@router.get("/coverage")
def coverage(user: dict = Depends(get_current_user)):
    return APIResponse(data=knowledge().coverage())


@router.post("/query", response_model=APIResponse[ChatAnswer])
def query(payload: ChatQuery, request: Request, user: dict = Depends(get_current_user)):
    # Per-account bound; endpoints expose only the deliberately published corpus.
    check_rate_limit(f"chatbot:{user['id']}", max_attempts=30, window_seconds=60)
    if any(len(question) > 1000 for question in payload.previous_questions):
        raise SentinelAPIException(message="Previous questions must be at most 1000 characters.", code="ERR_VALIDATION_FAILED", status_code=422)
    return APIResponse(data=knowledge().answer(payload))
