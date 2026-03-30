function Footer() {
  return (
    <footer>
      <span className="chip ok">ok</span>
      <span className="chip warn">warn</span>
      <span className="chip err">err</span>
      <a href="/metrics" target="_blank" rel="noreferrer">
        Prometheus metrics
      </a>
      <a href="/api/v1/system/health" target="_blank" rel="noreferrer">
        API health
      </a>
    </footer>
  );
}

export default Footer;
