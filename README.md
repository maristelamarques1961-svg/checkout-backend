# Checkout Backend - ConnectPay API

Backend seguro para geração de Pix via ConnectPay.

## 📦 Arquivos Necessários para Deploy

Para fazer upload no Render.com, você precisa APENAS destes 3 arquivos:

```
✓ server.js
✓ package.json
✓ package-lock.json
```

**NÃO faça upload de:**
- ❌ `node_modules/` (será instalado automaticamente)
- ❌ `.env` (configure no painel do Render)

## 🚀 Variáveis de Ambiente

Configure estas variáveis no painel do Render.com:

```
CONNECTPAY_API_SECRET=sk_7029eea634b02df91d011a60ba0e4488ef93fa7f033077573db2d7514e697eaa0fe0777cf4ee7589cdadae79de0ac998a0ec1662accfb9161f3d7aa4d99c9096
CONNECTPAY_RECIPIENT_ID=rcpt_06604b6a-c5d7-4367-ae12-02f559c622b2
PORT=3000
GOOGLE_SHEETS_WEBHOOK=https://script.google.com/macros/s/AKfycby4RoLNnz-KHuN-rPbpkTCVqqHYzk6Yf_tr-BQDUQw-AF0HPidXEI8aFum2SCpjCIr-/exec
TIKTOK_API_TOKEN=14feb461b0d55d3efdc33678bcc36de35bfcafcd
```

**Nota:** 
- `CONNECTPAY_API_SECRET`: **Obrigatório**. Esta é sua Chave API da ConnectPay.
- `CONNECTPAY_RECIPIENT_ID`: **Opcional**. Usado para splits de pagamento (divisão de valores). Se configurado, 100% do pagamento será direcionado para este recipient.
- `TIKTOK_API_TOKEN`: Opcional e usado para TikTok Events API (Server-side) se necessário.

## 🔧 Comandos de Build

**Build Command:**
```
npm install
```

**Start Command:**
```
npm start
```

## ✅ Endpoints

- `POST /api/create-pix` - Criar pedido Pix
- `GET /api/health` - Status do servidor

## 📝 Logs

Verifique os logs no painel do Render para debug.


