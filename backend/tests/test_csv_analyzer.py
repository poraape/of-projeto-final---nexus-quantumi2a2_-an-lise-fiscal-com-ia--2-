from __future__ import annotations

import io

import pytest

from app.services.csv_analyzer import analyse_csv_stream

# Test data with different delimiters and formats
CSV_COMMA_SEPARATED = """id,product,price,quantity,active
1,Laptop,1200.50,10,true
2,Mouse,25.00,100,true
3,Keyboard,75.99,50,false
4,Monitor,,20,true
"""

CSV_SEMICOLON_CURRENCY = """id;produto;valor;estoque
1;Caneta;R$ 3,50;1000
2;Caderno;R$ 15,90;500
3;Lápis;R$ 1,25;2000
4;Borracha;R$ 2,00;
"""

CSV_TAB_SEPARATED = """code	item	cost
A1	Thingamajig	19.99
B2	Widget	25.50
C3	Doodad	9.90
"""

@pytest.mark.anyio
def test_analyse_csv_with_comma_delimiter():
    """
    Tests analysis of a standard comma-separated CSV.
    """
    stream = io.BytesIO(CSV_COMMA_SEPARATED.encode('utf-8'))
    analysis = analyse_csv_stream(stream, filename="comma.csv")

    assert analysis["row_count"] == 4
    assert analysis["columns"] == ["id", "product", "price", "quantity", "active"]
    assert analysis["diagnostics"]["delimiter"] == ","

    # Check stats for a numeric column
    price_stats = analysis["stats"]["price"]
    assert price_stats["mean"] == pytest.approx(433.83, abs=1e-2)
    assert price_stats["median"] == pytest.approx(75.99, abs=1e-2)
    assert price_stats["nulls_pct"] == 25.0
    assert price_stats["non_nulls"] == 3

    # Check stats for a non-numeric column
    product_stats = analysis["stats"]["product"]
    assert product_stats["mean"] is None
    assert product_stats["median"] is None
    assert product_stats["non_nulls"] == 4

@pytest.mark.anyio
def test_analyse_csv_with_semicolon_delimiter_and_currency():
    """
    Tests analysis of a CSV with semicolons, currency symbols (R$), and comma decimals.
    """
    stream = io.BytesIO(CSV_SEMICOLON_CURRENCY.encode('latin-1'))
    analysis = analyse_csv_stream(stream, filename="semicolon.csv")

    assert analysis["row_count"] == 4
    assert analysis["columns"] == ["id", "produto", "valor", "estoque"]
    assert analysis["diagnostics"]["delimiter"] == ";"
    assert analysis["diagnostics"]["encoding"] == "latin-1"

    # Check stats for the "valor" column which requires cleaning
    valor_stats = analysis["stats"]["valor"]
    assert valor_stats["mean"] == pytest.approx(5.66, abs=1e-2)
    assert valor_stats["median"] == pytest.approx(2.75, abs=1e-2)
    assert valor_stats["nulls_pct"] == 0.0
    assert valor_stats["non_nulls"] == 4

    # Check stats for the "estoque" column with a missing value
    estoque_stats = analysis["stats"]["estoque"]
    assert estoque_stats["mean"] == pytest.approx(1166.66, abs=1e-2)
    assert estoque_stats["median"] == pytest.approx(1000.0, abs=1e-2)
    assert estoque_stats["nulls_pct"] == 25.0
    assert estoque_stats["non_nulls"] == 3

@pytest.mark.anyio
def test_analyse_csv_with_tab_delimiter():
    """
    Tests analysis of a tab-separated CSV.
    Note: The sample data has an extra backslash in the header.
    The sniffer should handle this gracefully.
    """
    # The header has an extra \, which we fix here for the test assertion
    expected_columns = ["code", "item", "cost"]
    stream = io.BytesIO(CSV_TAB_SEPARATED.encode('utf-8'))
    analysis = analyse_csv_stream(stream, filename="tab.csv")

    assert analysis["row_count"] == 3
    # The column name might be read as 'code\titem\tcost' if not sniffed correctly
    # or as separate columns. Let's check the sniffed delimiter and column names.
    assert analysis["diagnostics"]["delimiter"] == "\t"
    assert analysis["columns"] == expected_columns

    cost_stats = analysis["stats"]["cost"]
    assert cost_stats["mean"] == pytest.approx(18.46, abs=1e-2)
    assert cost_stats["median"] == pytest.approx(19.99, abs=1e-2)
    assert cost_stats["non_nulls"] == 3
