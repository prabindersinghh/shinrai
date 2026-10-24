from .aa_gst import AaGst
from .buildings_temporal import BuildingsTemporal, OsmBuildings
from .courts import Courts
from .geocode import Geocode
from .gst import Gst
from .ibbi import Ibbi
from .imagery_current import ImageryCurrent
from .imagery_timelapse import ImageryTimelapse
from .mca_directors import McaDirectors
from .mca_ogd import McaOgd
from .news import News
from .nightlights import NightLights
from .strikeoff import StrikeOff

ADAPTERS = {a.name: a for a in (McaOgd(), McaDirectors(), Gst(), Courts(), Ibbi(), StrikeOff(), News(), Geocode(),
                                ImageryCurrent(), ImageryTimelapse(), BuildingsTemporal(), OsmBuildings(),
                                NightLights(), AaGst())}
