# Publicar este site

Pasta estática pronta. Já vem ajustada para funcionar com o Helper do Linux:

- a versão do Roblox vem do **Helper** (`http://127.0.0.1:7962/roblox/version`),
  não do serviço de offsets do Windows;
- o portão "só funciona no Windows" foi removido;
- os textos mandam abrir o `helper.sh`, não o `help.bat`.

## Vercel

O painel da Vercel não aceita upload de .zip — ele publica a partir de um repo
ou da CLI. Escolha um dos dois:

**CLI (mais direto)**

```bash
npm i -g vercel
cd <esta pasta>
vercel --prod
```

Quando ele perguntar o framework, responda **Other**; o diretório de saída é a
própria pasta (`.`).

**GitHub**

1. Suba o conteúdo desta pasta num repositório.
2. Na Vercel: *Add New → Project → Import* desse repo.
3. Framework **Other**, Build Command **vazio**, Output Directory **`.`**.

## Cloudflare Pages / Netlify

Os dois aceitam upload direto de pasta ou .zip:

- Cloudflare Pages: *Create a project → Direct Upload* e solte a pasta. O
  `_worker.js` e o `_headers` já estão aqui.
- Netlify: arraste a pasta em *Sites → Add new site → Deploy manually*. O
  `_redirects` já está aqui.

## Depois de publicar

Na máquina que vai jogar:

```bash
bash helper.sh        # precisa estar aberto; é ele que fala com o Roblox
```

E abra o site publicado. Ele procura o Helper em `127.0.0.1:7962`–`7966`.

> O Helper tem que estar na porta **7962** para a versão do Roblox ser lida
> (é a porta padrão; ele só muda se algo estiver ocupando). Para forçar:
> `node helper/626.js 7962`.

## Offsets

`data/dumps/` tem os dumps que vão com o site. Para aplicar flags no Linux é
preciso um dump do cliente do Linux: rode o dumper com o Roblox aberto, copie o
`version-….json` para `site/dumps/` e rode `bash site/make-vercel.sh` de novo.
Sem isso o site funciona (ações, macros, atalhos), mas aplicar flag fica
bloqueado pela trava de versão — de propósito.
