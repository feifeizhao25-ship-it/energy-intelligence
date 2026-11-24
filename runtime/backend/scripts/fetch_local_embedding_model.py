"""一次性把本地向量模型放进 LOCAL_EMBEDDING_CACHE_DIR（构建镜像或部署前跑一次；运行时配 LOCAL_EMBEDDING_OFFLINE=1 不再联网）。

用法：LOCAL_EMBEDDING_CACHE_DIR=/srv/models python scripts/fetch_local_embedding_model.py [模型名，默认 LOCAL_EMBEDDING_MODEL 或 BAAI/bge-small-zh-v1.5]
"""
import os
import sys


def main() -> None:
    from fastembed import TextEmbedding

    name = sys.argv[1] if len(sys.argv) > 1 else (os.environ.get("LOCAL_EMBEDDING_MODEL") or "BAAI/bge-small-zh-v1.5")
    cache_dir = os.environ.get("LOCAL_EMBEDDING_CACHE_DIR") or None
    model = TextEmbedding(model_name=name, cache_dir=cache_dir)
    vector = next(iter(model.embed(["本地向量模型自检"])))
    print({"model": name, "dim": len(vector), "cache_dir": cache_dir})


if __name__ == "__main__":
    main()
