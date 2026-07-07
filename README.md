# Projeto Atlas

Projeto Atlas e um dashboard/manual gamificado de treino em casa para acompanhar evolucao fisica, consistencia, XP, ranks, conquistas e treinos semanais.

O app foi pensado para uma rotina simples de segunda a quinta, com futebol na sexta, usando equipamentos domesticos como mochila, cadeira firme, banco e corda.

## Objetivo

Ajudar a manter consistencia e evolucao em casa com foco em:

- postura;
- estetica atletica;
- hipertrofia;
- futebol;
- prevencao de lesoes;
- forca;
- mobilidade.

## Funcionalidades

- Dashboard com rank, level, XP e progresso visual.
- Missoes semanais: segunda, terca, quarta, quinta e futebol.
- Atributos com nivel e barra de progresso.
- Sistema de XP com treinos completos, treinos minimos, mobilidade, futebol e Exame Hunter.
- Ranks de E a S com requisitos fisicos tangiveis.
- Treinos da Temporada 1: Fundacao.
- Wiki/modal de exercicios na aba Treinos.
- Registro semanal com peso, treinos feitos, futebol e alertas de dor.
- Historico salvo localmente no navegador.
- Estimativa automatica de capacidade com base no historico.
- Exame Hunter proporcional a capacidade estimada.
- Status Enferrujado para periodos longos sem treino.
- Historico de acoes recentes com opcao de desfazer XP.
- Conquistas desbloqueaveis.

## PWA

O Projeto Atlas tambem funciona como PWA:

- pode ser instalado na tela inicial do celular;
- funciona offline depois do primeiro carregamento;
- usa `manifest.json` e `service-worker.js`;
- mantem os dados no proprio navegador com `localStorage`.

## Como usar localmente

Baixe ou clone o repositorio e abra o arquivo:

```txt
index.html
```

Nao precisa instalar dependencias, criar login, usar backend ou banco de dados.

## Como instalar no celular

1. Abra o site no navegador do celular.
2. No Chrome/Edge, toque no menu do navegador.
3. Escolha `Adicionar a tela inicial` ou `Instalar app`.
4. Depois do primeiro carregamento, o app deve abrir mesmo offline.

## Arquitetura

A versao atual organiza o codigo usando a metodologia CRUDE:

```txt
src/
  create/
  read/
  update/
  delete/
  execute/
  data/
  ui/
  app.js
```

A ideia e separar operacoes simples de dados das regras de negocio.

A tela apenas chama funcoes e renderiza resultados. Regras como XP, level, rank, streak, Enferrujado, Exame Hunter, conquistas e desfazer ficam na camada `execute`.

## Estrutura principal

```txt
index.html
style.css
script.js
manifest.json
service-worker.js
src/
```

## Privacidade

O Projeto Atlas nao tem login, backend ou banco de dados externo.

Os registros ficam salvos somente no navegador usado, via `localStorage`. Se os dados do navegador forem apagados, os registros do app tambem podem ser perdidos.

## Status

Projeto em evolucao. A prioridade atual e manter o app simples, funcional, leve e facil de usar no celular.
