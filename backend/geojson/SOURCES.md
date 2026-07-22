# Sources des limites administratives

- **Régions** (`morocco_regions.geojson`, 12 features) et **Provinces/Préfectures**
  (`morocco_provinces.geojson`, 75 features) : [geoBoundaries](https://www.geoboundaries.org/)
  (William & Mary geoLab), open data sous licence **Open Database License (ODbL)**,
  source OpenStreetMap. Téléchargé via l'API geoBoundaries (ADM1/ADM2 pour le Maroc,
  build `9469f09`).

- Chaque feature porte une propriété `geo_code` ajoutée par
  `backend/scripts/enrich_geojson.py`, qui fait correspondre la géométrie aux codes
  géographiques RGPH 2024 utilisés partout ailleurs dans l'app :
  - Régions : correspondance directe via `shapeISO` (`MA-01`..`MA-12` = codes HCP `1`..`12`).
  - Provinces/Préfectures : `shapeName` nettoyé (arabe retiré, préfixe "Province
    de/d'" retiré) puis rapproché par fuzzy matching (rapidfuzz) des 75 noms
    HCP. Toutes les correspondances sont loguées avec leur score ; aucune n'est
    restée non résolue.

## Limite connue : pas de géométrie au niveau commune

geoBoundaries ne fournit pas de niveau ADM3 pour le Maroc — il n'existe donc pas
de GeoJSON commune-level ouvert et fiable trouvé pour ce projet. Le module SIG
affiche donc des cartes choroplèthes jusqu'au niveau **Préfecture/Province**;
les données commune-level restent disponibles dans les tableaux et
l'explorateur, simplement sans rendu cartographique dédié. Si des shapefiles
officiels communaux (HCP/Direction de la Cartographie) deviennent disponibles,
déposez-les ici et étendez `enrich_geojson.py`.
