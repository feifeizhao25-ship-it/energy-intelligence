# Inject fake numpy only when a real numpy install is unavailable.
try:
    import numpy as _real_numpy

    _fake_numpy_mod = _real_numpy
except Exception:
    _fake_numpy_mod = types.ModuleType("numpy")
    _fake_numpy_mod.__version__ = "0.0-test"
    for _attr_name in dir(FakeNumpy):
        if not _attr_name.startswith("_"):
            setattr(_fake_numpy_mod, _attr_name, getattr(FakeNumpy, _attr_name))
    sys.modules["numpy"] = _fake_numpy_mod
