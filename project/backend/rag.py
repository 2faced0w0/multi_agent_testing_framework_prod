from bs4 import BeautifulSoup
import chromadb

def chunk_dom(html_content: str):
    """Parses raw HTML and chunks it into semantic trees."""
    soup = BeautifulSoup(html_content, 'html.parser')
    # Simple chunking by finding all major sub-sections
    chunks = []
    for section in soup.find_all(['div', 'section', 'main', 'form']):
        if len(section.text) > 50: # Only chunk meaningful blocks
            chunks.append(str(section))
    return chunks

def index_dom_chunks(chunks: list, collection_name: str = "dom_chunks"):
    """Indexes DOM chunks into an ephemeral ChromaDB collection for retrieval."""
    client = chromadb.Client()
    # Ensure ephemeral clean collection
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass
        
    collection = client.create_collection(collection_name)
    
    ids = [f"chunk_{i}" for i in range(len(chunks))]
    collection.add(
        documents=chunks,
        ids=ids
    )
    return collection

def retrieve_context(collection, query: str, n_results: int = 3):
    """Retrieves relevant DOM chunks based on a failure query."""
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return results['documents'][0]
