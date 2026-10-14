#!/usr/bin/env python3
"""Monta um backup fictício do Lastro Contagem com os mesmos números de tools/demo.json.

Serve para tirar as telas do app (assets/img/lastro-*.webp) com os mesmos
valores do relatório de exemplo do site. Tudo é inventado: empresa, itens,
códigos e contagens.

Uso: python3 tools/gerar_backup_demo.py SAIDA.json [--pendente CODIGO]
  --pendente deixa um item da amostra sem contagem (para a tela "contar").
"""
import json
import random
import sys
import uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
D = json.loads((RAIZ / "tools" / "demo.json").read_text(encoding="utf-8"))
rnd = random.Random(2026)

FAMILIAS = [
    ("EL", "Disjuntor monopolar {} A", ["6", "10", "16", "20", "25", "40", "50"], (14, 32), (20, 160), "B"),
    ("EL", "Cabo flexível {} mm (metro)", ["1,5", "4", "6", "10", "16"], (1.6, 14), (100, 900), "A"),
    ("EL", "Eletroduto corrugado {} (rolo 50 m)", ["1/2\"", "3/4\"", "1\""], (38, 95), (5, 40), "A"),
    ("EL", "Interruptor simples {}", ["branco", "preto", "cinza"], (6, 14), (20, 180), "B"),
    ("EL", "Caixa de passagem {}", ["4×2", "4×4", "octogonal"], (1.2, 4.5), (60, 400), "B"),
    ("EL", "Plugue macho {}", ["10 A", "20 A"], (3.5, 9), (30, 250), "B"),
    ("EL", "Conector de emenda {}", ["2 vias", "3 vias", "5 vias"], (0.9, 3.2), (100, 800), "Balcão"),
    ("EL", "Terminal tubular {} mm (pacote 100)", ["1,5", "2,5", "4", "6"], (7, 22), (10, 80), "Balcão"),
    ("EL", "DR tetrapolar {} A", ["25", "40", "63"], (120, 260), (2, 14), "B"),
    ("EL", "Contator tripolar {} A", ["9", "12", "18", "25", "32"], (70, 190), (3, 20), "B"),
    ("EL", "Fita isolante {}", ["5 m", "10 m", "autofusão"], (2.5, 24), (40, 300), "Balcão"),
    ("IL", "Lâmpada LED bulbo {} W", ["9", "12", "15", "20", "30"], (5, 26), (40, 400), "C"),
    ("IL", "Refletor LED {} W", ["30", "50", "100", "150"], (45, 210), (4, 30), "C"),
    ("IL", "Plafon LED {} W", ["12", "18", "24"], (22, 70), (6, 50), "C"),
    ("IL", "Fita LED {} (rolo 5 m)", ["3000 K", "4000 K", "6500 K"], (30, 85), (5, 40), "C"),
    ("HI", "Tubo PVC soldável {} (barra 6 m)", ["20 mm", "25 mm", "32 mm", "40 mm", "50 mm"], (14, 70), (10, 90), "D"),
    ("HI", "Joelho 90° soldável {}", ["20 mm", "25 mm", "32 mm", "40 mm"], (0.8, 6), (80, 600), "D"),
    ("HI", "Tê soldável {}", ["20 mm", "25 mm", "32 mm"], (1, 7), (60, 500), "D"),
    ("HI", "Luva de correr {}", ["20 mm", "25 mm", "32 mm"], (3, 11), (20, 200), "D"),
    ("HI", "Registro de pressão {}", ["1/2\"", "3/4\""], (28, 75), (5, 40), "D"),
    ("HI", "Torneira de jardim {}", ["1/2\"", "3/4\""], (12, 35), (10, 70), "D"),
    ("HI", "Sifão sanfonado {}", ["universal", "longo"], (6, 15), (15, 120), "D"),
    ("HI", "Caixa d'água {} L", ["310", "500", "1000"], (160, 520), (1, 8), "Pátio"),
    ("HI", "Fita veda-rosca {}", ["18 mm × 10 m", "18 mm × 25 m", "12 mm × 50 m"], (2, 9), (60, 400), "Balcão"),
    ("FE", "Parafuso sextavado {} (caixa 100)", ["M6×30", "M8×40", "M10×50", "M12×60"], (18, 75), (5, 60), "E"),
    ("FE", "Bucha de nylon {} (pacote 100)", ["6 mm", "8 mm", "10 mm"], (6, 18), (10, 120), "E"),
    ("FE", "Abraçadeira de nylon {} (pacote 100)", ["100 mm", "200 mm", "300 mm"], (5, 28), (20, 160), "E"),
    ("FE", "Broca para concreto {}", ["6 mm", "8 mm", "10 mm", "12 mm"], (7, 26), (10, 90), "E"),
]
VARIANTES = ["", " Linha A", " Linha B", " Pro", " Econômico", " Premium", " Branco", " Preto", " Cinza",
             " Kit 2", " Kit 5", " Kit 10", " Industrial", " Residencial"]


def custo_r(a, b):
    return round(rnd.uniform(a, b), 2)


def item(cod, desc, saldo, custo, end):
    return {"chave": cod.upper(), "cod": cod, "lote": "", "desc": desc, "saldo": saldo, "custo": round(custo, 2),
            "un": "m" if "(metro)" in desc else "un", "barras": "", "end": end, "val": ""}


def main():
    saida = Path(sys.argv[1])
    pendente = sys.argv[sys.argv.index("--pendente") + 1].upper() if "--pendente" in sys.argv else None

    demo = D["principais"] + D["outras"]
    b = D["bate_exemplo"]
    base = [item(i["cod"], i["nome"], i["sis"], i["custo"], i["end"]) for i in demo]
    base.append(item(b["cod"], b["nome"], b["sis"], b["custo"], b["end"]))
    fis = {i["cod"].upper(): i["fis"] for i in demo}
    usados = {x["chave"] for x in base}
    nomes = {x["desc"] for x in base}

    contador = {}
    while len(base) < D["cadastrados"]:
        pref, modelo, tams, faixa_c, faixa_s, rua = rnd.choice(FAMILIAS)
        desc = modelo.format(rnd.choice(tams)) + rnd.choice(VARIANTES)
        if desc in nomes:
            continue
        nomes.add(desc)
        contador[pref] = contador.get(pref, 4000) + rnd.randint(1, 7)
        cod = f"{pref}-{contador[pref]}"
        if cod.upper() in usados:
            continue
        usados.add(cod.upper())
        end = rua if rua in ("Balcão", "Pátio") else f"{rua}-{rnd.randint(1, 14):02d}"
        base.append(item(cod, desc, max(1, round(rnd.randint(*faixa_s) * 0.35)), custo_r(*faixa_c), end))

    # amostra: 60 de maior valor + 90 do restante (os itens do exemplo entram aqui)
    peso = lambda it: abs(it["saldo"] * it["custo"])
    ordem = sorted(base, key=peso, reverse=True)
    topo = ordem[:D["maior_valor"]]
    chaves_topo = {x["chave"] for x in topo}
    resto = ordem[D["maior_valor"]:]
    exemplo = [x for x in resto if x["chave"] in fis or x["chave"] == b["cod"].upper()]
    outros = [x for x in resto if x not in exemplo]
    rnd.shuffle(outros)
    aleat = exemplo + outros[:D["sorteados"] - len(exemplo)]
    rnd.shuffle(aleat)
    chaves = [x["chave"] for x in topo] + [x["chave"] for x in aleat]
    assert len(chaves) == 150 and len(set(chaves)) == 150

    # contagens: quantidade física = demo para os divergentes, igual ao sistema para os demais
    contadores = ["Equipe Lastro · dupla 1", "Equipe Lastro · dupla 2"]
    por_chave = {x["chave"]: x for x in base}
    contagens = []
    for n, k in enumerate(sorted(chaves, key=lambda k: por_chave[k]["end"])):
        if k == pendente:
            continue
        it = por_chave[k]
        h, m = divmod(8 * 60 + n * 2, 60)
        contagens.append({"id": str(uuid.UUID(int=rnd.getrandbits(128))), "chave": k, "codLido": "", "desc": "",
                          "qtd": fis.get(k, it["saldo"]), "rodada": 1, "contador": contadores[n % 2], "end": it["end"],
                          "quando": f"2026-10-10T{h:02d}:{m:02d}:00-03:00"})
        if k in fis:  # divergentes recontados por outra dupla, confirmando a quantidade
            contagens.append({"id": str(uuid.UUID(int=rnd.getrandbits(128))), "chave": k, "codLido": "", "desc": "",
                              "qtd": fis[k], "rodada": 2, "contador": contadores[(n + 1) % 2], "end": it["end"],
                              "quando": f"2026-10-10T{h + 5:02d}:{m:02d}:00-03:00"})

    projeto = {
        "id": "demo-raiox-distribuidora", "cliente": "Distribuidora fictícia (demonstração)", "tipo": "raiox",
        "data": "2026-10-10", "responsavel": "Equipe Lastro", "criadoEm": "2026-10-09T18:00:00-03:00",
        "atualizadoEm": "2026-10-10T14:00:00-03:00",
        "base": {"arquivo": "cadastro-ficticio.xlsx", "importadoEm": "2026-10-09T18:05:00-03:00", "itens": base},
        "amostra": {"geradaEm": "2026-10-09T18:10:00-03:00", "nTop": len(topo), "nAleat": len(aleat), "semente": 2026,
                    "porCusto": True, "chaves": chaves, "topo": [x["chave"] for x in topo]},
        "contagens": contagens, "decisoes": {"zero": {}},
        "relatorio": {
            "causas": " ".join(c[0] + " " + c[1] for c in D["causas"]),
            "limitacoes": "Dados fictícios para demonstração. Os valores valem para a amostra, não para o estoque inteiro.",
            "plano": [
                {"prio": "Alta", "acao": D["acoes"][0], "resp": "Compras", "prazo": "Esta semana"},
                {"prio": "Alta", "acao": D["acoes"][1], "resp": "Vendas", "prazo": "Imediato"},
                {"prio": "Média", "acao": D["acoes"][2], "resp": "Estoque", "prazo": "15 dias"},
                {"prio": "Média", "acao": D["acoes"][3], "resp": "Recebimento", "prazo": "30 dias"},
            ],
        },
    }
    saida.write_text(json.dumps({"formato": "lastro-contagem", "versao": 1, "exportadoEm": "2026-10-10T14:00:00-03:00",
                                 "projeto": projeto}, ensure_ascii=False), encoding="utf-8")
    print(f"{saida}: {len(base)} itens, amostra {len(chaves)} ({len(topo)} + {len(aleat)}), {len(contagens)} contagens,"
          f" exemplo no topo: {len([k for k in fis if k in chaves_topo])}")


if __name__ == "__main__":
    main()
