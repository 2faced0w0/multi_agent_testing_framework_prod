import os
import git
import shutil
import tempfile
from pathlib import Path
from typing import List, Dict, Any
import chromadb

SUPPORTED_EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.html'}
CHUNK_SIZE = 1500  # characters per chunk

def chunk_text(text: str, size: int = CHUNK_SIZE) -> List[str]:
    return [text[i:i+size] for i in range(0, len(text), size)]

def clone_and_index(repo_url: str, github_token: str | None = None) -> Dict[str, Any]:
    """
    Shallow-clones a GitHub repository and indexes its source files into ChromaDB.
    Supports private repos if github_token is provided.
    """
    # Build authenticated URL for private repos
    if github_token and repo_url.startswith('https://github.com/'):
        auth_url = repo_url.replace('https://', f'https://{github_token}@')
    else:
        auth_url = repo_url

    tmpdir = tempfile.mkdtemp(prefix='safest_repo_')

    try:
        # Shallow clone (depth=1 for speed)
        git.Repo.clone_from(auth_url, tmpdir, depth=1)

        # Connect to ChromaDB
        client = chromadb.Client()
        try:
            collection = client.get_collection('dom_chunks')
        except Exception:
            collection = client.create_collection('dom_chunks')

        documents, metadatas, ids = [], [], []
        file_count = 0

        for path in Path(tmpdir).rglob('*'):
            if path.suffix in SUPPORTED_EXTENSIONS and path.is_file():
                try:
                    content = path.read_text(encoding='utf-8', errors='ignore')
                    chunks = chunk_text(content)
                    relative = str(path.relative_to(tmpdir))

                    for i, chunk in enumerate(chunks):
                        doc_id = f'{repo_url}::{relative}::{i}'
                        documents.append(chunk)
                        metadatas.append({'repo_url': repo_url, 'file': relative, 'chunk': i})
                        ids.append(doc_id)

                    file_count += 1
                except Exception:
                    continue

        # Batch upsert into ChromaDB
        if documents:
            collection.upsert(documents=documents, metadatas=metadatas, ids=ids)

        return {'status': 'indexed', 'file_count': file_count, 'chunk_count': len(documents)}

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
