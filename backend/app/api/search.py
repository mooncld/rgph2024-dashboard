from fastapi import APIRouter

from app.engines import search_engine
from app.models.schemas import SearchRequest

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("")
def search(req: SearchRequest):
    return search_engine.generate_response(req.query)


@router.get("/suggestions")
def suggestions():
    """Static example queries for the search bar's placeholder/autocomplete seed."""
    return [
        "Nombre total de chômeurs à Agadir",
        "Population de Casablanca",
        "Taux d'alphabétisation des femmes à Rabat",
        "Nombre de ménages urbains à Marrakech",
        "Nombre de femmes au chômage à Tanger",
        "Population âgée de 15 à 24 ans dans la région Souss-Massa",
        "Taux de chômage dans la région de Fès-Meknès",
        "Population rurale de la province de Taroudant",
    ]
