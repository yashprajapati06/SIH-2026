"""Authenticated access to the public GSI reference corpus across all 8 states.

This separate overlay never reads or changes jurisdiction-scoped operational data.
"""
from fastapi import APIRouter, Depends, Path, Query

from src.core.gsi_history import get_historical_inventory
from src.core.errors import NotFoundException, SentinelAPIException
from src.core.security.dependencies import get_current_user
from src.schemas.chatbot import State
from src.schemas.common import APIResponse

router = APIRouter(prefix="/gsi-history", tags=["GSI historical reference layer"])


def inventory():
    try:
        return get_historical_inventory()
    except (OSError, ValueError, KeyError, TypeError):
        raise SentinelAPIException(message="The GSI historical dataset is unavailable. Please restore the validated snapshot and retry.", code="ERR_GSI_HISTORY_UNAVAILABLE", status_code=503) from None


@router.get("")
def snapshot(state: State | None = None, district: str | None = Query(None, min_length=1, max_length=100), user: dict = Depends(get_current_user)):
    return APIResponse(data=inventory().snapshot(state, district))


@router.get("/{record_id}")
def record(record_id: int = Path(ge=1), user: dict = Depends(get_current_user)):
    row = inventory().records.get(record_id)
    if row is None:
        raise NotFoundException("GSI historical record", str(record_id))
    return APIResponse(data=row)
