import unicodedata
import re
import requests
from typing import Tuple, Optional, Dict, Any
import database

# Standard provinces dictionary with common aliases and abbreviations in Argentina
PROVINCE_ALIASES: Dict[str, str] = {
    # Buenos Aires / CABA
    "buenos aires": "buenos aires",
    "bs as": "buenos aires",
    "bsas": "buenos aires",
    "pba": "buenos aires",
    "bue": "buenos aires",
    "caba": "buenos aires",
    "ciudad autonoma de buenos aires": "buenos aires",
    "capital federal": "buenos aires",
    # Cordoba
    "cordoba": "cordoba",
    "cba": "cordoba",
    # Santa Fe
    "santa fe": "santa fe",
    "sta fe": "santa fe",
    "sf": "santa fe",
    # Entre Rios
    "entre rios": "entre rios",
    "e rios": "entre rios",
    "er": "entre rios",
    # Corrientes
    "corrientes": "corrientes",
    "ctes": "corrientes",
    # Chaco
    "chaco": "chaco",
    # Misiones
    "misiones": "misiones",
    "mis": "misiones",
    # Mendoza
    "mendoza": "mendoza",
    "mza": "mendoza",
    # San Juan
    "san juan": "san juan",
    "sj": "san juan",
    # San Luis
    "san luis": "san luis",
    "sl": "san luis",
    # Tucuman
    "tucuman": "tucuman",
    "tuc": "tucuman",
    # Salta
    "salta": "salta",
    # Jujuy
    "jujuy": "jujuy",
    # Santiago del Estero
    "santiago del estero": "santiago del estero",
    "sgo del estero": "santiago del estero",
    "sgo": "santiago del estero",
    # Catamarca
    "catamarca": "catamarca",
    # La Rioja
    "la rioja": "la rioja",
    # Formosa
    "formosa": "formosa",
    # La Pampa
    "la pampa": "la pampa",
    "pampa": "la pampa",
    # Neuquen
    "neuquen": "neuquen",
    "nqn": "neuquen",
    # Rio Negro
    "rio negro": "rio negro",
    "rn": "rio negro",
    # Chubut
    "chubut": "chubut",
    # Santa Cruz
    "santa cruz": "santa cruz",
    "sc": "santa cruz",
    # Tierra del Fuego
    "tierra del fuego": "tierra del fuego",
    "tdf": "tierra del fuego",
}

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", str(text)).encode("ASCII", "ignore").decode("utf-8")
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def normalize_province(province: str) -> str:
    norm = normalize_text(province)
    return PROVINCE_ALIASES.get(norm, norm)

# Exact (city_normalized, province_normalized) catalog
PRESET_CITY_PROVINCE: Dict[Tuple[str, str], Tuple[float, float, str, str]] = {
    # Buenos Aires & AMBA
    ("buenos aires", "buenos aires"): (-34.6037, -58.3816, "Buenos Aires", "Buenos Aires"),
    ("caba", "buenos aires"): (-34.6037, -58.3816, "CABA", "Buenos Aires"),
    ("ciudad autonoma de buenos aires", "buenos aires"): (-34.6037, -58.3816, "CABA", "Buenos Aires"),
    ("la plata", "buenos aires"): (-34.9214, -57.9545, "La Plata", "Buenos Aires"),
    ("mar del plata", "buenos aires"): (-38.0055, -57.5562, "Mar del Plata", "Buenos Aires"),
    ("bahia blanca", "buenos aires"): (-38.7183, -62.2663, "Bahía Blanca", "Buenos Aires"),
    ("tandil", "buenos aires"): (-37.3217, -59.1332, "Tandil", "Buenos Aires"),
    ("olavarria", "buenos aires"): (-36.8927, -60.3225, "Olavarría", "Buenos Aires"),
    ("pergamino", "buenos aires"): (-33.8967, -60.5736, "Pergamino", "Buenos Aires"),
    ("san nicolas", "buenos aires"): (-33.3333, -60.2167, "San Nicolás", "Buenos Aires"),
    ("junin", "buenos aires"): (-34.5838, -60.9433, "Junín", "Buenos Aires"),
    ("necochea", "buenos aires"): (-38.5473, -58.7368, "Necochea", "Buenos Aires"),
    ("azul", "buenos aires"): (-36.7770, -59.8585, "Azul", "Buenos Aires"),
    ("chivilcoy", "buenos aires"): (-34.8957, -60.0167, "Chivilcoy", "Buenos Aires"),
    ("zarate", "buenos aires"): (-34.0956, -59.0242, "Zárate", "Buenos Aires"),
    ("campana", "buenos aires"): (-34.1687, -58.9591, "Campana", "Buenos Aires"),
    ("quilmes", "buenos aires"): (-34.7242, -58.2527, "Quilmes", "Buenos Aires"),
    ("moron", "buenos aires"): (-34.6534, -58.6198, "Morón", "Buenos Aires"),
    ("san isidro", "buenos aires"): (-34.4719, -58.5281, "San Isidro", "Buenos Aires"),
    ("pilar", "buenos aires"): (-34.4587, -58.9142, "Pilar", "Buenos Aires"),
    ("tigre", "buenos aires"): (-34.4260, -58.5796, "Tigre", "Buenos Aires"),
    ("lujan", "buenos aires"): (-34.5703, -59.1050, "Luján", "Buenos Aires"),
    ("mercedes", "buenos aires"): (-34.6514, -59.4307, "Mercedes", "Buenos Aires"),
    ("avellaneda", "buenos aires"): (-34.6627, -58.3653, "Avellaneda", "Buenos Aires"),

    # Cordoba
    ("cordoba", "cordoba"): (-31.4201, -64.1888, "Córdoba", "Córdoba"),
    ("rio cuarto", "cordoba"): (-33.1232, -64.3493, "Río Cuarto", "Córdoba"),
    ("villa maria", "cordoba"): (-32.4075, -63.2402, "Villa María", "Córdoba"),
    ("san francisco", "cordoba"): (-31.4333, -62.0833, "San Francisco", "Córdoba"),
    ("villa carlos paz", "cordoba"): (-31.4241, -64.4978, "Villa Carlos Paz", "Córdoba"),
    ("alta gracia", "cordoba"): (-31.6529, -64.4283, "Alta Gracia", "Córdoba"),
    ("rio tercero", "cordoba"): (-32.1731, -64.1142, "Río Tercero", "Córdoba"),
    ("bell ville", "cordoba"): (-32.6258, -62.6887, "Bell Ville", "Córdoba"),
    ("jesus maria", "cordoba"): (-30.9815, -64.0942, "Jesús María", "Córdoba"),
    ("la falda", "cordoba"): (-31.0886, -64.4897, "La Falda", "Córdoba"),
    ("cosquin", "cordoba"): (-31.2444, -64.4656, "Cosquín", "Córdoba"),
    ("marcos juarez", "cordoba"): (-32.6967, -62.1067, "Marcos Juárez", "Córdoba"),
    ("arroyito", "cordoba"): (-31.4208, -63.0500, "Arroyito", "Córdoba"),
    ("las varillas", "cordoba"): (-31.8740, -62.7161, "Las Varillas", "Córdoba"),
    ("la carlota", "cordoba"): (-33.4194, -63.2972, "La Carlota", "Córdoba"),
    ("montecristo", "cordoba"): (-31.3444, -63.9444, "Montecristo", "Córdoba"),
    ("monte cristo", "cordoba"): (-31.3444, -63.9444, "Monte Cristo", "Córdoba"),
    ("morteros", "cordoba"): (-30.7114, -61.9986, "Morteros", "Córdoba"),
    ("rio primero", "cordoba"): (-31.3314, -63.6167, "Río Primero", "Córdoba"),
    ("rio segundo", "cordoba"): (-31.6500, -63.9167, "Río Segundo", "Córdoba"),
    ("villa allende", "cordoba"): (-31.2944, -64.2956, "Villa Allende", "Córdoba"),
    ("general deheza", "cordoba"): (-32.7561, -63.7889, "General Deheza", "Córdoba"),
    ("el trebol", "cordoba"): (-32.1973, -61.7099, "El Trébol", "Córdoba"),
    ("san jorge", "cordoba"): (-31.8967, -61.8603, "San Jorge", "Santa Fe"),

    # Santa Fe
    ("rosario", "santa fe"): (-32.9468, -60.6393, "Rosario", "Santa Fe"),
    ("santa fe", "santa fe"): (-31.6333, -60.7000, "Santa Fe", "Santa Fe"),
    ("rafaela", "santa fe"): (-31.2503, -61.4867, "Rafaela", "Santa Fe"),
    ("venado tuerto", "santa fe"): (-33.7456, -61.9688, "Venado Tuerto", "Santa Fe"),
    ("reconquista", "santa fe"): (-29.1500, -59.6500, "Reconquista", "Santa Fe"),
    ("santo tome", "santa fe"): (-31.6628, -60.7656, "Santo Tomé", "Santa Fe"),
    ("esperanza", "santa fe"): (-31.4489, -60.9328, "Esperanza", "Santa Fe"),
    ("villa constitucion", "santa fe"): (-33.2278, -60.3297, "Villa Constitución", "Santa Fe"),
    ("casilda", "santa fe"): (-33.0442, -61.1681, "Casilda", "Santa Fe"),
    ("san lorenzo", "santa fe"): (-32.7461, -60.7333, "San Lorenzo", "Santa Fe"),
    ("canada de gomez", "santa fe"): (-32.8167, -61.3958, "Cañada de Gómez", "Santa Fe"),
    ("avellaneda", "santa fe"): (-29.1172, -59.6569, "Avellaneda", "Santa Fe"),
    ("franck", "santa fe"): (-31.5833, -60.9333, "Franck", "Santa Fe"),
    ("granadero baigorria", "santa fe"): (-32.8548, -60.7074, "Granadero Baigorria", "Santa Fe"),
    ("las toscas", "santa fe"): (-28.3533, -59.2567, "Las Toscas", "Santa Fe"),
    ("vera", "santa fe"): (-29.4608, -60.2136, "Vera", "Santa Fe"),
    ("villa gobernador galvez", "santa fe"): (-33.0251, -60.6337, "Villa Gobernador Gálvez", "Santa Fe"),
    ("receptoria rosario", "santa fe"): (-32.9468, -60.6393, "Receptoría Rosario", "Santa Fe"),
    ("san nicolas", "santa fe"): (-33.3333, -60.2167, "San Nicolás", "Santa Fe"),
    ("san jorge", "santa fe"): (-31.8967, -61.8603, "San Jorge", "Santa Fe"),
    ("el trebol", "santa fe"): (-32.1973, -61.7099, "El Trébol", "Santa Fe"),
    ("parana", "santa fe"): (-31.7319, -60.5238, "Paraná (Área Metropolitana)", "Santa Fe"),

    # Entre Rios
    ("parana", "entre rios"): (-31.7319, -60.5238, "Paraná", "Entre Ríos"),
    ("concordia", "entre rios"): (-31.3930, -58.0209, "Concordia", "Entre Ríos"),
    ("gualeguaychu", "entre rios"): (-33.0094, -58.5172, "Gualeguaychú", "Entre Ríos"),
    ("concepcion del uruguay", "entre rios"): (-32.4844, -58.2328, "Concepción del Uruguay", "Entre Ríos"),

    # Corrientes & Chaco & Misiones
    ("corrientes", "corrientes"): (-27.4692, -58.8306, "Corrientes", "Corrientes"),
    ("goya", "corrientes"): (-29.1442, -59.2636, "Goya", "Corrientes"),
    ("paso de los libres", "corrientes"): (-29.7125, -57.0878, "Paso de los Libres", "Corrientes"),
    ("santo tome", "corrientes"): (-28.5494, -56.0408, "Santo Tomé", "Corrientes"),
    ("resistencia", "chaco"): (-27.4514, -58.9867, "Resistencia", "Chaco"),
    ("saenz pena", "chaco"): (-26.7852, -60.4388, "Sáenz Peña", "Chaco"),
    ("posadas", "misiones"): (-27.3671, -55.8961, "Posadas", "Misiones"),
    ("obera", "misiones"): (-27.4872, -55.1197, "Oberá", "Misiones"),
    ("eldorado", "misiones"): (-26.4069, -54.6297, "Eldorado", "Misiones"),
    ("puerto iguazu", "misiones"): (-25.5991, -54.5735, "Puerto Iguazú", "Misiones"),
    ("formosa", "formosa"): (-26.1775, -58.1781, "Formosa", "Formosa"),

    # Cuyo & Mendoza
    ("mendoza", "mendoza"): (-32.8895, -68.8458, "Mendoza", "Mendoza"),
    ("san rafael", "mendoza"): (-34.6177, -68.3301, "San Rafael", "Mendoza"),
    ("godoy cruz", "mendoza"): (-32.9298, -68.8354, "Godoy Cruz", "Mendoza"),
    ("guaymallen", "mendoza"): (-32.8992, -68.7907, "Guaymallén", "Mendoza"),
    ("las heras", "mendoza"): (-32.8500, -68.8167, "Las Heras", "Mendoza"),
    ("san martin", "mendoza"): (-33.0811, -68.4681, "San Martín", "Mendoza"),
    ("general alvear", "mendoza"): (-34.9750, -67.6833, "General Alvear", "Mendoza"),
    ("san juan", "san juan"): (-31.5375, -68.5364, "San Juan", "San Juan"),
    ("san luis", "san luis"): (-33.2950, -66.3356, "San Luis", "San Luis"),
    ("villa mercedes", "san luis"): (-33.6758, -65.4578, "Villa Mercedes", "San Luis"),
    ("merlo", "san luis"): (-32.3428, -65.0139, "Merlo", "San Luis"),

    # NOA
    ("san miguel de tucuman", "tucuman"): (-26.8241, -65.2226, "San Miguel de Tucumán", "Tucumán"),
    ("tucuman", "tucuman"): (-26.8241, -65.2226, "Tucumán", "Tucumán"),
    ("salta", "salta"): (-24.7821, -65.4232, "Salta", "Salta"),
    ("oran", "salta"): (-23.1322, -64.3264, "Orán", "Salta"),
    ("tartagal", "salta"): (-22.5164, -63.8014, "Tartagal", "Salta"),
    ("san salvador de jujuy", "jujuy"): (-24.1858, -65.2995, "San Salvador de Jujuy", "Jujuy"),
    ("jujuy", "jujuy"): (-24.1858, -65.2995, "Jujuy", "Jujuy"),
    ("santiago del estero", "santiago del estero"): (-27.7951, -64.2615, "Santiago del Estero", "Santiago del Estero"),
    ("la banda", "santiago del estero"): (-27.7333, -64.2500, "La Banda", "Santiago del Estero"),
    ("termas de rio hondo", "santiago del estero"): (-27.4933, -64.8594, "Termas de Río Hondo", "Santiago del Estero"),
    ("san fernando del valle de catamarca", "catamarca"): (-28.4696, -65.7852, "San Fernando del Valle de Catamarca", "Catamarca"),
    ("catamarca", "catamarca"): (-28.4696, -65.7852, "Catamarca", "Catamarca"),
    ("la rioja", "la rioja"): (-29.4131, -66.8558, "La Rioja", "La Rioja"),

    # Patagonia
    ("neuquen", "neuquen"): (-38.9516, -68.0591, "Neuquén", "Neuquén"),
    ("san carlos de bariloche", "rio negro"): (-41.1342, -71.3085, "San Carlos de Bariloche", "Río Negro"),
    ("bariloche", "rio negro"): (-41.1342, -71.3085, "Bariloche", "Río Negro"),
    ("general roca", "rio negro"): (-39.0267, -67.5756, "General Roca", "Río Negro"),
    ("cipolletti", "rio negro"): (-38.9392, -67.9906, "Cipolletti", "Río Negro"),
    ("viedma", "rio negro"): (-40.8135, -62.9967, "Viedma", "Río Negro"),
    ("comodoro rivadavia", "chubut"): (-45.8656, -67.5008, "Comodoro Rivadavia", "Chubut"),
    ("trelew", "chubut"): (-43.2490, -65.3051, "Trelew", "Chubut"),
    ("puerto madryn", "chubut"): (-42.7692, -65.0385, "Puerto Madryn", "Chubut"),
    ("esquel", "chubut"): (-42.9115, -71.3195, "Esquel", "Chubut"),
    ("rio gallegos", "santa cruz"): (-51.6226, -69.2181, "Río Gallegos", "Santa Cruz"),
    ("calafate", "santa cruz"): (-50.3380, -72.2648, "El Calafate", "Santa Cruz"),
    ("el calafate", "santa cruz"): (-50.3380, -72.2648, "El Calafate", "Santa Cruz"),
    ("ushuaia", "tierra del fuego"): (-54.8019, -68.3030, "Ushuaia", "Tierra del Fuego"),
    ("rio grande", "tierra del fuego"): (-53.7877, -67.7094, "Río Grande", "Tierra del Fuego"),
    ("santa rosa", "la pampa"): (-36.6167, -64.2833, "Santa Rosa", "La Pampa"),
    ("general pico", "la pampa"): (-35.6566, -63.7568, "General Pico", "La Pampa"),
}

# Standalone city fallback catalog (when province is unknown or matching city only)
PRESET_CITIES: Dict[str, Tuple[float, float, str]] = {
    # Default city coordinates (lat, lon, default_province)
    "buenos aires": (-34.6037, -58.3816, "Buenos Aires"),
    "caba": (-34.6037, -58.3816, "Buenos Aires"),
    "la plata": (-34.9214, -57.9545, "Buenos Aires"),
    "mar del plata": (-38.0055, -57.5562, "Buenos Aires"),
    "bahia blanca": (-38.7183, -62.2663, "Buenos Aires"),
    "tandil": (-37.3217, -59.1332, "Buenos Aires"),
    "olavarria": (-36.8927, -60.3225, "Buenos Aires"),
    "pergamino": (-33.8967, -60.5736, "Buenos Aires"),
    "san nicolas": (-33.3333, -60.2167, "Buenos Aires"),
    "junin": (-34.5838, -60.9433, "Buenos Aires"),
    "necochea": (-38.5473, -58.7368, "Buenos Aires"),
    "azul": (-36.7770, -59.8585, "Buenos Aires"),
    "chivilcoy": (-34.8957, -60.0167, "Buenos Aires"),
    "zarate": (-34.0956, -59.0242, "Buenos Aires"),
    "campana": (-34.1687, -58.9591, "Buenos Aires"),
    "quilmes": (-34.7242, -58.2527, "Buenos Aires"),
    "moron": (-34.6534, -58.6198, "Buenos Aires"),
    "san isidro": (-34.4719, -58.5281, "Buenos Aires"),
    "pilar": (-34.4587, -58.9142, "Buenos Aires"),
    "tigre": (-34.4260, -58.5796, "Buenos Aires"),
    "lujan": (-34.5703, -59.1050, "Buenos Aires"),
    "mercedes": (-34.6514, -59.4307, "Buenos Aires"),
    "cordoba": (-31.4201, -64.1888, "Córdoba"),
    "rio cuarto": (-33.1232, -64.3493, "Córdoba"),
    "villa maria": (-32.4075, -63.2402, "Córdoba"),
    "san francisco": (-31.4333, -62.0833, "Córdoba"),
    "villa carlos paz": (-31.4241, -64.4978, "Córdoba"),
    "alta gracia": (-31.6529, -64.4283, "Córdoba"),
    "rio tercero": (-32.1731, -64.1142, "Córdoba"),
    "bell ville": (-32.6258, -62.6887, "Córdoba"),
    "jesus maria": (-30.9815, -64.0942, "Córdoba"),
    "la falda": (-31.0886, -64.4897, "Córdoba"),
    "cosquin": (-31.2444, -64.4656, "Córdoba"),
    "marcos juarez": (-32.6967, -62.1067, "Córdoba"),
    "arroyito": (-31.4208, -63.0500, "Córdoba"),
    "las varillas": (-31.8740, -62.7161, "Córdoba"),
    "la carlota": (-33.4194, -63.2972, "Córdoba"),
    "montecristo": (-31.3444, -63.9444, "Córdoba"),
    "morteros": (-30.7114, -61.9986, "Córdoba"),
    "rio primero": (-31.3314, -63.6167, "Córdoba"),
    "rio segundo": (-31.6500, -63.9167, "Córdoba"),
    "villa allende": (-31.2944, -64.2956, "Córdoba"),
    "general deheza": (-32.7561, -63.7889, "Córdoba"),
    "rosario": (-32.9468, -60.6393, "Santa Fe"),
    "santa fe": (-31.6333, -60.7000, "Santa Fe"),
    "rafaela": (-31.2503, -61.4867, "Santa Fe"),
    "venado tuerto": (-33.7456, -61.9688, "Santa Fe"),
    "reconquista": (-29.1500, -59.6500, "Santa Fe"),
    "santo tome": (-31.6628, -60.7656, "Santa Fe"),
    "esperanza": (-31.4489, -60.9328, "Santa Fe"),
    "villa constitucion": (-33.2278, -60.3297, "Santa Fe"),
    "casilda": (-33.0442, -61.1681, "Santa Fe"),
    "san lorenzo": (-32.7461, -60.7333, "Santa Fe"),
    "canada de gomez": (-32.8167, -61.3958, "Santa Fe"),
    "avellaneda": (-29.1172, -59.6569, "Santa Fe"),
    "franck": (-31.5833, -60.9333, "Santa Fe"),
    "granadero baigorria": (-32.8548, -60.7074, "Santa Fe"),
    "las toscas": (-28.3533, -59.2567, "Santa Fe"),
    "vera": (-29.4608, -60.2136, "Santa Fe"),
    "villa gobernador galvez": (-33.0251, -60.6337, "Santa Fe"),
    "receptoria rosario": (-32.9468, -60.6393, "Santa Fe"),
    "el trebol": (-32.1973, -61.7099, "Santa Fe"),
    "san jorge": (-31.8967, -61.8603, "Santa Fe"),
    "parana": (-31.7319, -60.5238, "Entre Ríos"),
    "concordia": (-31.3930, -58.0209, "Entre Ríos"),
    "gualeguaychu": (-33.0094, -58.5172, "Entre Ríos"),
    "concepcion del uruguay": (-32.4844, -58.2328, "Entre Ríos"),
    "corrientes": (-27.4692, -58.8306, "Corrientes"),
    "goya": (-29.1442, -59.2636, "Corrientes"),
    "paso de los libres": (-29.7125, -57.0878, "Corrientes"),
    "resistencia": (-27.4514, -58.9867, "Chaco"),
    "posadas": (-27.3671, -55.8961, "Misiones"),
    "formosa": (-26.1775, -58.1781, "Formosa"),
    "mendoza": (-32.8895, -68.8458, "Mendoza"),
    "san rafael": (-34.6177, -68.3301, "Mendoza"),
    "godoy cruz": (-32.9298, -68.8354, "Mendoza"),
    "guaymallen": (-32.8992, -68.7907, "Mendoza"),
    "las heras": (-32.8500, -68.8167, "Mendoza"),
    "general alvear": (-34.9750, -67.6833, "Mendoza"),
    "san juan": (-31.5375, -68.5364, "San Juan"),
    "san luis": (-33.2950, -66.3356, "San Luis"),
    "villa mercedes": (-33.6758, -65.4578, "San Luis"),
    "merlo": (-32.3428, -65.0139, "San Luis"),
    "san miguel de tucuman": (-26.8241, -65.2226, "Tucumán"),
    "tucuman": (-26.8241, -65.2226, "Tucumán"),
    "salta": (-24.7821, -65.4232, "Salta"),
    "oran": (-23.1322, -64.3264, "Salta"),
    "tartagal": (-22.5164, -63.8014, "Salta"),
    "san salvador de jujuy": (-24.1858, -65.2995, "Jujuy"),
    "jujuy": (-24.1858, -65.2995, "Jujuy"),
    "santiago del estero": (-27.7951, -64.2615, "Santiago del Estero"),
    "la banda": (-27.7333, -64.2500, "Santiago del Estero"),
    "termas de rio hondo": (-27.4933, -64.8594, "Santiago del Estero"),
    "san fernando del valle de catamarca": (-28.4696, -65.7852, "Catamarca"),
    "catamarca": (-28.4696, -65.7852, "Catamarca"),
    "la rioja": (-29.4131, -66.8558, "La Rioja"),
    "neuquen": (-38.9516, -68.0591, "Neuquén"),
    "san carlos de bariloche": (-41.1342, -71.3085, "Río Negro"),
    "bariloche": (-41.1342, -71.3085, "Río Negro"),
    "general roca": (-39.0267, -67.5756, "Río Negro"),
    "cipolletti": (-38.9392, -67.9906, "Río Negro"),
    "viedma": (-40.8135, -62.9967, "Río Negro"),
    "comodoro rivadavia": (-45.8656, -67.5008, "Chubut"),
    "trelew": (-43.2490, -65.3051, "Chubut"),
    "puerto madryn": (-42.7692, -65.0385, "Chubut"),
    "esquel": (-42.9115, -71.3195, "Chubut"),
    "rio gallegos": (-51.6226, -69.2181, "Santa Cruz"),
    "calafate": (-50.3380, -72.2648, "Santa Cruz"),
    "el calafate": (-50.3380, -72.2648, "Santa Cruz"),
    "ushuaia": (-54.8019, -68.3030, "Tierra del Fuego"),
    "rio grande": (-53.7877, -67.7094, "Tierra del Fuego"),
    "santa rosa": (-36.6167, -64.2833, "La Pampa"),
    "general pico": (-35.6566, -63.7568, "La Pampa"),
}

def check_city_province_exact(city: str, province: str) -> Dict[str, Any]:
    """
    Evaluates whether the EXACT combination of (Provincia-Ciudad1, Ciudad1) has been found.
    Returns dictionary with:
      - exact_found: bool (True if city and province match exactly)
      - match_type: str ("EXACT_PRESET", "EXACT_GEOCODED", "CITY_ONLY", "NOT_FOUND")
      - lat: float
      - lon: float
      - display_name: str
      - details: str (User-friendly explanation)
    """
    clean_city = normalize_text(city)
    clean_prov = normalize_province(province)

    if not clean_city:
        return {
            "exact_found": False,
            "match_type": "NOT_FOUND",
            "lat": -34.6037,
            "lon": -58.3816,
            "display_name": "Ciudad desconocida",
            "details": "Nombre de ciudad vacío o inválido."
        }

    # 1. Exact match in preset catalog for (city, province)
    if (clean_city, clean_prov) in PRESET_CITY_PROVINCE:
        lat, lon, std_c, std_p = PRESET_CITY_PROVINCE[(clean_city, clean_prov)]
        return {
            "exact_found": True,
            "match_type": "EXACT_PRESET",
            "lat": lat,
            "lon": lon,
            "display_name": f"{std_c}, {std_p}",
            "details": f"Combinación exacta verificada en catálogo ({std_c}, {std_p})"
        }

    # 2. Check SQLite geocache with both city and province
    query_exact = f"{city}, {province}".strip(", ")
    cached = database.get_cached_geo(query_exact)
    if cached:
        cached_disp = (cached.get("display_name") or "").lower()
        # Verify that province is mentioned in cached display name
        if clean_prov and clean_prov in normalize_text(cached_disp):
            return {
                "exact_found": True,
                "match_type": "EXACT_GEOCODED",
                "lat": cached["lat"],
                "lon": cached["lon"],
                "display_name": cached.get("display_name") or query_exact,
                "details": f"Combinación exacta verificada desde geocaché ({cached.get('display_name')})"
            }

    # 3. Check Nominatim with explicit city, province, Argentina
    if clean_prov:
        term = f"{city}, {province}, Argentina"
        headers = {"User-Agent": "CredifinRoutesVisualizer/1.0 (contact: info@credifin-routes.local)"}
        try:
            resp = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": term, "format": "json", "limit": 1},
                headers=headers,
                timeout=4
            )
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lon = float(data[0]["lon"])
                    disp = data[0].get("display_name", term)
                    database.save_cached_geo(query_exact, lat, lon, disp)
                    # Check if the result indeed matches the province
                    norm_disp = normalize_text(disp)
                    if clean_prov in norm_disp or norm_disp.find(clean_prov) != -1:
                        return {
                            "exact_found": True,
                            "match_type": "EXACT_GEOCODED",
                            "lat": lat,
                            "lon": lon,
                            "display_name": disp,
                            "details": f"Combinación exacta verificada con OSM: {disp}"
                        }
                    else:
                        return {
                            "exact_found": False,
                            "match_type": "PROVINCE_MISMATCH",
                            "lat": lat,
                            "lon": lon,
                            "display_name": disp,
                            "details": f"Se localizó '{city}', pero la provincia devuelta no coincide exactamente con '{province}'."
                        }
        except Exception:
            pass

    # 4. Fallback: Was city found alone in presets?
    if clean_city in PRESET_CITIES:
        lat, lon, def_prov = PRESET_CITIES[clean_city]
        is_exact = bool(clean_prov and clean_prov == normalize_province(def_prov))
        return {
            "exact_found": is_exact,
            "match_type": "EXACT_PRESET" if is_exact else "CITY_ONLY",
            "lat": lat,
            "lon": lon,
            "display_name": f"{city.title()}, {def_prov}",
            "details": f"Ciudad encontrada ({def_prov}). " + ("Provincia coincide exactamente." if is_exact else f"Provincia en CSV '{province}' difiere o no fue especificada.")
        }

    # 5. Check cache for city alone
    cached_city = database.get_cached_geo(city)
    if cached_city:
        return {
            "exact_found": False,
            "match_type": "CITY_ONLY",
            "lat": cached_city["lat"],
            "lon": cached_city["lon"],
            "display_name": cached_city.get("display_name") or city,
            "details": f"Ciudad '{city}' encontrada en caché, pero sin confirmación exacta de la provincia '{province}'."
        }

    # 6. Not found fallback
    return {
        "exact_found": False,
        "match_type": "NOT_FOUND",
        "lat": -34.6037,
        "lon": -58.3816,
        "display_name": f"{city} (Aprox.)",
        "details": f"No se encontró geolocalización para '{city}' en '{province}'."
    }

def geocode_location(city: str, province: str = "") -> Tuple[float, float, str]:
    """
    Standard geocode function returning (lat, lon, display_name).
    Uses the exact matcher underneath.
    """
    res = check_city_province_exact(city, province)
    return res["lat"], res["lon"], res["display_name"]
