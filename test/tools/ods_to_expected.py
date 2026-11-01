#!/usr/bin/env python3 -I
# Genera test/fixtures/expected-<tab>.json leggendo content.xml degli ODS (SheetJS non e' disponibile
# offline). Replica cio' che fa SheetJS per gli ODS: testo visualizzato (text:p) per ogni cella,
# valore numerico (office:value) per le celle float. Uso: python3 -I test/tools/ods_to_expected.py
import json, os, sys, zipfile
import xml.etree.ElementTree as ET

NS = {
    "t": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "o": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "x": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
T = lambda n: "{%s}%s" % (NS["t"], n)
O = lambda n: "{%s}%s" % (NS["o"], n)
X = lambda n: "{%s}%s" % (NS["x"], n)

def text_of(el):
    out = []
    def walk(e):
        if e.text: out.append(e.text)
        for c in e:
            if c.tag == X("s"): out.append(" " * int(c.get(X("c"), "1")))
            elif c.tag == X("tab"): out.append("\t")
            elif c.tag == X("line-break"): out.append("\n")
            else: walk(c)
            if c.tail: out.append(c.tail)
    walk(el)
    return "".join(out)

def cell_text(cell):
    return "\n".join(text_of(p) for p in cell.findall(X("p")))

def read_table(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("content.xml"))
    table = root.find(".//t:table", NS)
    grid = []
    for row in table.iter(T("table-row")):
        cells = []
        for c in row.findall(T("table-cell")):
            n = int(c.get(T("number-columns-repeated"), "1"))
            w = cell_text(c)
            v = float(c.get(O("value"))) if c.get(O("value-type")) == "float" and c.get(O("value")) is not None else None
            if n > 1000 and not w: n = 1   # riempimento fino al bordo del foglio
            cells.extend([(w, v)] * n)
        r = int(row.get(T("number-rows-repeated"), "1"))
        if r > 1000: continue
        grid.extend([cells] * r)
    return grid

def table_json(path, price_keys):
    grid = read_table(path)
    headers = [w for (w, _) in grid[0]]
    while headers and headers[-1] == "": headers.pop()
    rows = []
    for cells in grid[1:]:
        row, any_val = {}, False
        for i, h in enumerate(headers):
            w, v = cells[i] if i < len(cells) else ("", None)
            row[h] = w
            if w != "": any_val = True
            if h in price_keys and v is not None:
                row[h + "__raw"] = int(v) if v == int(v) else v
        if any_val: rows.append(row)
    return {"headers": headers, "rows": rows}

if __name__ == "__main__":
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
    for tab, ods, keys in [("Vasi", "vasi", {"price_new", "price_old"}),
                           ("Masterclass", "masterclass", {"price"}),
                           ("Certificati", "certificati", {"amount_eur"})]:
        out = table_json(os.path.join(base, "catalogue", ods + ".ods"), keys)
        p = os.path.join(base, "test", "fixtures", "expected-%s.json" % tab)
        with open(p, "w", encoding="utf8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1); f.write("\n")
        print(p, len(out["rows"]), "rows")
