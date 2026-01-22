from fastapi import APIRouter

from routers import bookmarks, destinations, local_badge, local_columns, places, reviews, search


router = APIRouter(prefix="/places", tags=["Places"])

router.include_router(search.router)
router.include_router(local_badge.router)
router.include_router(local_columns.router)
router.include_router(destinations.router)
router.include_router(reviews.router)
router.include_router(bookmarks.router)
router.include_router(places.router)
