import json
import threading
import pyautogui
import speech_recognition as sr
import pyttsx3
import ollama
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Voice Controller API para Cypress Real World App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=False,  
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELO_OLLAMA = 'llama3.2'

SYSTEM_PROMPT = """
Você é o assistente de voz do Cypress Real World App.
Sua missão é mapear os comandos de voz em rotas e seletores do React.

Responda APENAS um objeto JSON no formato:
{
  "acao": "<NOME_DA_ACAO>",
  "rota": "<ROTA_DO_REACT_SE_HOUVER>",
  "texto_botao": "<TEXTO_DO_BOTAO_SE_HOUVER>",
  "parametro": "<TEXTO_PARA_DIGITAR_SE_HOUVER>",
  "falar": "<MENSAGEM_A_FALAR>"
}

Ações permitidas:
1. "ATIVAR_ASSISTENTE": Quando o usuário disser "ativar assistente", "ligar voz" ou "ei assistente".
2. "NAVEGAR": Quando o usuário quer ir para uma página.
   - Home / Inicio -> rota: "/"
   - Perfil / Configurações -> rota: "/user/settings"
   - Notificações -> rota: "/notifications"
   - Minha Conta / Transações -> rota: "/personal"
   - Nova Transação -> rota: "/transaction/new"
   - Contas Bancárias -> rota: "/bankaccounts"
3. "CLICAR_TEXTO": Quando o usuário diz "clicar em [Nome do Botão]" ou "apertar [Nome]".
   - texto_botao: texto exato do botão visível na tela
4. "DIGITAR": Quando o usuário pede para digitar algo. 'parametro' = texto.
5. "ROLAR_BAIXO": Quando o usuário disser "rolar para baixo", "descer página" ou "descer".
   - falar: "Descendo página"
6. "ROLAR_CIMA": Quando o usuário disser "rolar para cima", "subir página" ou "subir".
   - falar: "Subindo página"
7. "DESCONHECIDO": Comando não reconhecido.
"""
ultimo_comando_processado = {"acao": "NENHUM"}

def falar(texto):
    if not texto:
        return
    print(f"🤖 Assistente: {texto}")
    def _falar():
        try:
            engine = pyttsx3.init()
            voices = engine.getProperty('voices')
            for voice in voices:
                if "brazil" in voice.name.lower() or "portuguese" in voice.name.lower():
                    engine.setProperty('voice', voice.id)
                    break
            engine.setProperty('rate', 180)
            engine.say(texto)
            engine.runAndWait()
        except Exception as e:
            print(f"Erro na síntese de voz: {e}")
            
    threading.Thread(target=_falar, daemon=True).start()

def interpretar_comando(comando_voz):
    try:
        response = ollama.chat(
            model=MODELO_OLLAMA,
            messages=[
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': f"Comando: '{comando_voz}'"}
            ],
            options={'temperature': 0.1}
        )
        conteudo = response['message']['content'].strip()
        conteudo = conteudo.replace("```json", "").replace("```", "").strip()
        return json.loads(conteudo)
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"acao": "DESCONHECIDO", "parametro": None, "falar": "Erro ao processar o comando."}


def executar_acao(decisao):
    global ultimo_comando_processado
    acao = decisao.get("acao")
    print(f"⚡ Ação registrada para o React: {acao} | Decisão: {decisao}")
    

    ultimo_comando_processado = decisao

ouvinte_ativo = False

def loop_escuta_continua():
    global ouvinte_ativo
    recognizer = sr.Recognizer()
    recognizer.dynamic_energy_threshold = True
    
    print("🎙️ Microfone pronto e escutando...")
    
    while ouvinte_ativo:
        try:
            with sr.Microphone() as source:
                recognizer.adjust_for_ambient_noise(source, duration=0.3)
                print("[Aguardando fala...]")
                audio = recognizer.listen(source, timeout=5, phrase_time_limit=5)
                
            print("⚙️ Processando áudio...")
            texto = recognizer.recognize_google(audio, language="pt-BR").lower()
            print(f"🗣️ Você disse: '{texto}'")

            if len(texto.strip()) >= 3:
                decisao = interpretar_comando(texto)
                falar(decisao.get("falar"))
                executar_acao(decisao)

        except sr.WaitTimeoutError:
            continue
        except sr.UnknownValueError:
            print("Áudio não compreendido, tentando novamente...")
            continue
        except Exception as e:
            print(f"Erro na escuta: {e}")

class ComandoTexto(BaseModel):
    texto: str

@app.get("/ultimo-comando")
def get_ultimo_comando():
    global ultimo_comando_processado
    comando = ultimo_comando_processado

    ultimo_comando_processado = {"acao": "NENHUM"}
    return comando

@app.post("/executar-texto")
def executar_texto(dado: ComandoTexto):
    decisao = interpretar_comando(dado.texto)
    falar(decisao.get("falar"))
    executar_acao(decisao)
    return decisao

@app.post("/ouvinte/iniciar")
def iniciar_ouvinte():
    global ouvinte_ativo
    if not ouvinte_ativo:
        ouvinte_ativo = True
        falar("Ouvinte por voz ativado.")
        thread_escuta = threading.Thread(target=loop_escuta_continua, daemon=True)
        thread_escuta.start()
        return {"status": "Escuta ativada"}
    return {"status": "Já está ativo"}

@app.post("/ouvinte/parar")
def parar_ouvinte():
    global ouvinte_ativo
    ouvinte_ativo = False
    falar("Ouvinte por voz desligado.")
    return {"status": "Escuta desativada"}