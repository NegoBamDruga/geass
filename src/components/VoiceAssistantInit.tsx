import React, { useEffect, useRef, useState } from "react";
import { Paper, Typography, Box, Chip, IconButton } from "@material-ui/core";
import RecordVoiceOverIcon from "@material-ui/icons/RecordVoiceOver";

export const VoiceAssistantInit: React.FC = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mensagemStatus, setMensagemStatus] = useState<string>("Iniciando assistente...");
  const [ativo, setAtivo] = useState<boolean>(false);
  const [expandido, setExpandido] = useState<boolean>(true); // true no início (feedback de conexão)

  const simularTecla = (tecla: "ArrowUp" | "ArrowDown" | "PageDown" | "PageUp") => {
    const elementoAlvo = document.activeElement || window;

    const keyCodes: Record<string, number> = {
      ArrowUp: 38,
      ArrowDown: 40,
      PageUp: 33,
      PageDown: 34,
    };

    const eventoKeyDown = new KeyboardEvent("keydown", {
      key: tecla,
      code: tecla,
      keyCode: keyCodes[tecla],
      which: keyCodes[tecla],
      bubbles: true,
      cancelable: true,
    });

    const eventoKeyUp = new KeyboardEvent("keyup", {
      key: tecla,
      code: tecla,
      keyCode: keyCodes[tecla],
      which: keyCodes[tecla],
      bubbles: true,
      cancelable: true,
    });

    elementoAlvo.dispatchEvent(eventoKeyDown);
    elementoAlvo.dispatchEvent(eventoKeyUp);
  };

  // Expande temporariamente o card e agenda o recolhimento automático
  const expandirTemporariamente = (duracaoMs = 3000) => {
    setExpandido(true);
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
    }
    expandTimeoutRef.current = setTimeout(() => {
      setExpandido(false);
    }, duracaoMs);
  };

  useEffect(() => {
    let cancelado = false;

    const iniciarAssistenteAosCarregar = async () => {
      try {
        const resposta = await fetch("http://localhost:8000/ouvinte/iniciar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const dados = await resposta.json();
        console.log("🤖 Status do Assistente de Voz:", dados.status);

        if (cancelado) return;

        setAtivo(true);
        setMensagemStatus("Comando por voz ativo! Tente dizer: 'Descer página'");
        expandirTemporariamente(4000); // mostra o card completo por 4s ao conectar, depois minimiza

        intervalRef.current = setInterval(async () => {
          try {
            const resComando = await fetch("http://localhost:8000/ultimo-comando");
            if (resComando.ok) {
              const comando = await resComando.json();

              if (comando && comando.acao && comando.acao !== "NENHUM") {
                console.log("⚡ Executando Comando no React:", comando);

                // Exibe brevemente na tela o comando detectado
                setMensagemStatus(`Comando detectado: ${comando.acao}`);
                expandirTemporariamente(3000); // expande ao detectar comando, some depois de 3s

                if (comando.acao === "DESCER_PAGINA") {
                  simularTecla("PageDown");
                } else if (comando.acao === "SUBIR_PAGINA") {
                  simularTecla("PageUp");
                }

                window.dispatchEvent(
                  new CustomEvent("VOICE_COMMAND", { detail: comando })
                );

                // Volta para o texto padrão após 3 segundos
                setTimeout(() => {
                  if (!cancelado) {
                    setMensagemStatus("Ouvindo comandos de voz...");
                  }
                }, 3000);
              }
            }
          } catch (err) {

          }
        }, 1000);
      } catch (erro) {
        console.error("Erro ao conectar com a API Python:", erro);
        setAtivo(false);
        setMensagemStatus("Assistente offline (verifique o servidor Python)");
        expandirTemporariamente(4000); // mostra o erro por 4s, depois minimiza
      }
    };

    iniciarAssistenteAosCarregar();

    return () => {
      cancelado = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (expandTimeoutRef.current) {
        clearTimeout(expandTimeoutRef.current);
      }
      fetch("http://localhost:8000/ouvinte/parar", { method: "POST" }).catch(() => {});
    };
  }, []);

  // ---- Estado minimizado: só o ícone, clicável para reabrir ----
  if (!expandido) {
    return (
      <IconButton
        onClick={() => expandirTemporariamente(4000)}
        style={{
          backgroundColor: ativo ? "#1976d2" : "#757575",
          color: "#fff",
          width: 44,
          height: 44,
          boxShadow: "0px 2px 8px rgba(0,0,0,0.25)",
          transition: "background-color 0.3s ease",
        }}
        aria-label="Assistente de voz"
      >
        <RecordVoiceOverIcon fontSize="small" />
      </IconButton>
    );
  }

  // ---- Estado expandido: card completo ----
  return (
    <Paper
      elevation={6}
      style={{
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        backgroundColor: "#1976d2",
        color: "#fff",
        borderRadius: "8px",
        maxWidth: "280px",
        boxShadow: "0px 4px 12px rgba(0,0,0,0.2)",
        transition: "opacity 0.3s ease",
      }}
    >
      <RecordVoiceOverIcon style={{ marginRight: 12, fontSize: 28, color: "#fff" }} />
      <Box flexGrow={1}>
        <Box display="flex" alignItems="center" marginBottom="2px">
          <Typography variant="subtitle2" style={{ fontWeight: "bold", marginRight: 8 }}>
            Navegação por Voz
          </Typography>
          <Chip
            label={ativo ? "Ativo" : "Offline"}
            size="small"
            style={{
              height: 18,
              fontSize: "0.65rem",
              backgroundColor: ativo ? "#4caf50" : "#f44336",
              color: "#fff",
            }}
          />
        </Box>
        <Typography variant="caption" style={{ display: "block", color: "#e3f2fd" }}>
          {mensagemStatus}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={() => setExpandido(false)}
        style={{ color: "#fff", marginLeft: 4 }}
        aria-label="Minimizar"
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
      </IconButton>
    </Paper>
  );
};

export default VoiceAssistantInit;