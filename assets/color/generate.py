"""Generate the project's standard sRGB ICC profile with installed LittleCMS 2."""
import ctypes
import ctypes.util
from pathlib import Path

library = ctypes.util.find_library('lcms2')
if not library:
    raise SystemExit('LittleCMS 2 is required')
lcms = ctypes.CDLL(library)
lcms.cmsCreate_sRGBProfile.restype = ctypes.c_void_p
lcms.cmsSaveProfileToFile.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lcms.cmsSaveProfileToFile.restype = ctypes.c_int
lcms.cmsCloseProfile.argtypes = [ctypes.c_void_p]
profile = lcms.cmsCreate_sRGBProfile()
if not profile:
    raise SystemExit('Cannot create standard sRGB profile')
try:
    target = Path(__file__).with_name('sRGB.icc')
    if target.exists():
        raise SystemExit('Refusing to overwrite existing profile; review a new version first')
    if not lcms.cmsSaveProfileToFile(profile, bytes(target)):
        raise SystemExit('Cannot save ICC profile')
finally:
    lcms.cmsCloseProfile(profile)
