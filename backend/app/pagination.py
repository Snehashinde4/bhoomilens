"""Shared pagination, filtering and response helpers."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import Query
from pydantic import BaseModel


class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int


class QueryParams:
    """Common list parameters: pagination, search, sorting and ad-hoc filters."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="1-based page number"),
        page_size: int = Query(25, ge=1, le=500, description="Rows per page"),
        search: Optional[str] = Query(None, description="Free-text search across the main columns"),
        sort_by: Optional[str] = Query(None, description="Field name to sort by"),
        sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
        state: Optional[str] = Query(None),
        district: Optional[str] = Query(None),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.search = search
        self.sort_by = sort_by
        self.sort_dir = sort_dir
        self.state = state
        self.district = district


def apply_scope(rows: List[Dict[str, Any]], params: QueryParams) -> List[Dict[str, Any]]:
    out = rows
    if params.state:
        out = [r for r in out if r.get("state") == params.state]
    if params.district:
        out = [r for r in out if r.get("district") == params.district]
    return out


def paginate(
    rows: List[Dict[str, Any]],
    params: QueryParams,
    search_keys: Optional[List[str]] = None,
) -> Dict[str, Any]:
    out = apply_scope(rows, params)

    if params.search:
        needle = params.search.lower()
        keys = search_keys or (list(out[0].keys()) if out else [])
        out = [r for r in out if any(needle in str(r.get(k, "")).lower() for k in keys)]

    if params.sort_by:
        reverse = params.sort_dir == "desc"
        out = sorted(out, key=lambda r: _sort_key(r.get(params.sort_by)), reverse=reverse)

    total = len(out)
    start = (params.page - 1) * params.page_size
    sliced = out[start : start + params.page_size]
    pages = max(1, (total + params.page_size - 1) // params.page_size)

    return {
        "rows": sliced,
        "meta": {"total": total, "page": params.page, "page_size": params.page_size, "pages": pages},
    }


def _sort_key(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return value
    return str(value).lower()
