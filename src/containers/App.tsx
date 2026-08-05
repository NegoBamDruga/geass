import React, { useEffect } from "react";
import { styled } from "@material-ui/core/styles";
import { Switch, Route, Redirect, useHistory } from "react-router-dom";
import { useActor, useMachine } from "@xstate/react";
import { CssBaseline } from "@material-ui/core";

import { snackbarMachine } from "../machines/snackbarMachine";
import { notificationsMachine } from "../machines/notificationsMachine";
import { authService } from "../machines/authMachine";
import AlertBar from "../components/AlertBar";
import SignInForm from "../components/SignInForm";
import SignUpForm from "../components/SignUpForm";
import { bankAccountsMachine } from "../machines/bankAccountsMachine";
import PrivateRoutesContainer from "./PrivateRoutesContainer";
import { VoiceAssistantInit } from "../components/VoiceAssistantInit";

const PREFIX = "App";

const classes = {
  root: `${PREFIX}-root`,
  voiceWidgetWrapper: `${PREFIX}-voiceWidgetWrapper`,
};

const Root = styled("div")(({ theme }) => ({
  [`&.${classes.root}`]: {
    display: "flex",
  },
  [`& .${classes.voiceWidgetWrapper}`]: {
    position: "fixed",
    top: "50%",
    right: "20px",
    transform: "translateY(-50%)", // sem scale — o próprio componente já controla o tamanho
    zIndex: 9999,
  },
}));

if (window.Cypress) {
  window.authService = authService;
}

const VOICE_API_BASE_URL = "http://localhost:8000";

// Função aprimorada para localizar e preencher (ou limpar, passando valor "")
// qualquer input no RWA
const preencherCampo = (seletorOuNome: string, valor: string) => {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea, select"
    )
  );

  const term = seletorOuNome.toLowerCase();

  const alvo = inputs.find((el) => {
    const id = el.id?.toLowerCase() || "";
    const name = el.name?.toLowerCase() || "";
    const placeholder = el.placeholder?.toLowerCase() || "";
    const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() || "";
    const dataTest = el.getAttribute("data-test")?.toLowerCase() || "";

    return (
      id.includes(term) ||
      name.includes(term) ||
      placeholder.includes(term) ||
      ariaLabel.includes(term) ||
      dataTest.includes(term) ||
      // Aliases em português para a interface em inglês
      (term.includes("primeiro nome") && (id.includes("first") || name.includes("first"))) ||
      (term.includes("sobrenome") && (id.includes("last") || name.includes("last"))) ||
      (term.includes("confirmar") && (id.includes("confirm") || name.includes("confirm"))) ||
      (term.includes("banco") && (id.includes("bank") || name.includes("bank"))) ||
      (term.includes("routing") && id.includes("routing")) ||
      (term.includes("conta") && (id.includes("account") || name.includes("account"))) ||
      (term.includes("valor") && (id.includes("amount") || placeholder.includes("amount"))) ||
      (term.includes("nota") && (id.includes("note") || placeholder.includes("note"))) ||
      (term.includes("comentario") && placeholder.includes("comment")) ||
      (term.includes("busca") && placeholder.includes("search"))
    );
  });

  if (alvo) {
    alvo.focus();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(alvo, valor);
    } else {
      alvo.value = valor;
    }

    alvo.dispatchEvent(new Event("input", { bubbles: true }));
    alvo.dispatchEvent(new Event("change", { bubbles: true }));
    alvo.blur();

    if (valor === "") {
      console.log(`🧹 Campo '${seletorOuNome}' limpo.`);
    } else {
      console.log(`✅ Campo '${seletorOuNome}' preenchido com: "${valor}"`);
    }
  } else {
    console.warn(`⚠️ Campo '${seletorOuNome}' não foi encontrado na tela.`);
  }
};

// ============================================================================
// SNAPSHOT COMPLETO DA INTERFACE — enviado ao backend a cada mudança de tela
// ============================================================================
//
// Em vez de mandar campos, botões e links separadamente, montamos um único
// retrato da tela atual (rota, título, cabeçalhos, campos com seu estado,
// botões, links, diálogos abertos, elemento em foco) e mandamos tudo de uma
// vez pro endpoint /estado-interface. O backend usa isso tanto pros
// matchers locais por posição ("segundo botão") quanto como contexto pra
// camada de IA — que só pode citar algo que exista de fato nesse snapshot.
//
// Assim como botões/links, esse snapshot muda com frequência: modais que
// abrem/fecham, listas paginadas, campos que ficam desabilitados etc. Por
// isso a coleta não depende só da navegação — também escutamos mudanças no
// DOM (MutationObserver) e reenviamos o snapshot atualizado.

// Extrai um rótulo legível/estável para o elemento clicável. A ordem de
// prioridade favorece o texto visível (o que o usuário realmente vê e
// tende a falar), caindo para atributos de acessibilidade/teste quando não
// há texto (ex: um ícone sem legenda).
const identificarElementoClicavel = (el: HTMLElement): string => {
  return (
    el.innerText?.trim() ||
    el.getAttribute("aria-label")?.trim() ||
    el.getAttribute("data-test")?.trim() ||
    el.getAttribute("title")?.trim() ||
    ""
  );
};

// Só contam elementos realmente visíveis e utilizáveis na tela — evita
// enumerar botões/campos escondidos (display:none, dentro de modais
// fechados), o que confundiria a numeração falada pelo usuário e a IA.
const estaVisivel = (el: HTMLElement) => {
  if (el.offsetParent === null) return false;
  const estilo = window.getComputedStyle(el);
  return estilo.visibility !== "hidden" && estilo.display !== "none";
};

// Acha o rótulo humano de um campo de formulário: <label for="id">, label
// pai (quando o input está aninhado dentro do <label>), aria-label,
// placeholder, name ou id — nessa ordem de preferência.
const identificarRotuloDoCampo = (el: HTMLElement): string => {
  const id = el.getAttribute("id");
  if (id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    if (label?.innerText?.trim()) return label.innerText.trim();
  }

  const labelPai = el.closest("label");
  if (labelPai?.innerText?.trim()) return labelPai.innerText.trim();

  return (
    el.getAttribute("aria-label")?.trim() ||
    (el as HTMLInputElement).placeholder?.trim() ||
    el.getAttribute("name")?.trim() ||
    id?.trim() ||
    ""
  );
};

const coletarBotoesELinks = () => {
  const botoes = Array.from(
    document.querySelectorAll<HTMLElement>(
      "button, input[type='submit'], input[type='button'], [role='button']"
    )
  )
    .filter((el) => estaVisivel(el) && !(el as HTMLButtonElement).disabled)
    .map(identificarElementoClicavel)
    .filter(Boolean);

  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[href]")
  )
    .filter(estaVisivel)
    .map(identificarElementoClicavel)
    .filter(Boolean);

  return { botoes, links };
};

// Campos de formulário visíveis, com o nível de detalhe que o backend
// espera em EstadoDaInterface.campos: nome técnico (id/name — o mesmo que
// preencherCampo já usa pra localizar o elemento), rótulo falável, tipo do
// input, e se já está preenchido/desabilitado (ajuda a IA a não sugerir
// preencher de novo um campo que já tem valor, por exemplo).
const coletarCamposDoFormulario = () => {
  return Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select"
    )
  )
    .filter((el) => {
      const tipo = (el as HTMLInputElement).type;
      return estaVisivel(el) && tipo !== "hidden" && tipo !== "submit" && tipo !== "button";
    })
    .map((el) => ({
      nome: el.id || el.name || identificarRotuloDoCampo(el),
      rotulo: identificarRotuloDoCampo(el),
      tipo: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
      preenchido: Boolean((el as HTMLInputElement).value?.trim()),
      desabilitado: Boolean((el as HTMLInputElement).disabled),
    }))
    .filter((campo) => campo.nome);
};

// Cabeçalhos visíveis (h1/h2) — dão à IA uma noção rápida de "em que tela
// eu estou" além da rota bruta.
const coletarCabecalhos = () =>
  Array.from(document.querySelectorAll<HTMLElement>("h1, h2"))
    .filter(estaVisivel)
    .map((el) => el.innerText?.trim())
    .filter(Boolean)
    .slice(0, 10);

// Diálogos/modais abertos no momento (Material UI usa role="dialog" e a
// classe MuiDialog-root/MuiModal-root). Identificamos pelo título interno
// quando houver, senão pelo mesmo critério usado em botões/links.
const coletarDialogosAbertos = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      "[role='dialog'], .MuiDialog-root, .MuiModal-root"
    )
  )
    .filter(estaVisivel)
    .map((el) => {
      const titulo = el.querySelector<HTMLElement>("h1, h2, h3, .MuiDialogTitle-root");
      return titulo?.innerText?.trim() || identificarElementoClicavel(el);
    })
    .filter(Boolean);

// Qual elemento está com foco agora — ajuda a IA a resolver comandos
// ambíguos tipo "apaga isso aqui" sem o usuário precisar nomear o campo.
const identificarElementoEmFoco = (): string | null => {
  const ativo = document.activeElement as HTMLElement | null;
  if (!ativo || ativo === document.body) return null;

  const tag = ativo.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return identificarRotuloDoCampo(ativo) || null;
  }
  return identificarElementoClicavel(ativo) || null;
};

// Monta o snapshot completo da tela atual, no formato que o backend espera
// em POST /estado-interface (ver EstadoDaInterface no voice_backend.py).
const coletarEstadoDaInterface = () => {
  const { botoes, links } = coletarBotoesELinks();
  return {
    rota: window.location.pathname,
    titulo: document.title || "",
    cabecalhos: coletarCabecalhos(),
    campos: coletarCamposDoFormulario(),
    botoes,
    links,
    dialogos: coletarDialogosAbertos(),
    elementoEmFoco: identificarElementoEmFoco(),
  };
};

const atualizarEstadoDaInterface = async () => {
  try {
    await fetch(`${VOICE_API_BASE_URL}/estado-interface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coletarEstadoDaInterface()),
    });
  } catch (erro) {
    console.warn(
      "⚠️ Não foi possível atualizar o estado da interface para o assistente de voz:",
      erro
    );
  }
};

const App: React.FC = () => {
  const history = useHistory();
  const [authState] = useActor(authService);

  const [, , notificationsService] = useMachine(notificationsMachine);
  const [, , snackbarService] = useMachine(snackbarMachine);
  const [, , bankAccountsService] = useMachine(bankAccountsMachine);

  // Mantém o backend do assistente de voz sabendo o retrato completo da
  // tela atual — no carregamento inicial, a cada navegação, e a cada
  // mudança relevante no DOM (botões/links/diálogos surgem e somem o tempo
  // todo, ao contrário dos campos de formulário que são mais estáveis).
  useEffect(() => {
    atualizarEstadoDaInterface();

    const cancelarListener = history.listen(() => {
      // Aguarda a renderização da nova rota antes de tirar o snapshot.
      setTimeout(atualizarEstadoDaInterface, 300);
    });

    // O snapshot não depende só de rota — modais, listas e menus mudam o
    // DOM sem trocar de página. O debounce evita disparar uma requisição a
    // cada micro-alteração (ex: várias mudanças em sequência durante uma
    // animação).
    let debounceRef: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceRef) clearTimeout(debounceRef);
      debounceRef = setTimeout(atualizarEstadoDaInterface, 500);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "disabled", "hidden", "value"],
    });

    // Foco muda sem necessariamente alterar o DOM (ex: Tab entre campos
    // já existentes), então precisa do próprio listener de foco — o
    // MutationObserver sozinho não pega isso.
    const handleFocusChange = () => {
      if (debounceRef) clearTimeout(debounceRef);
      debounceRef = setTimeout(atualizarEstadoDaInterface, 300);
    };
    document.addEventListener("focusin", handleFocusChange);
    document.addEventListener("focusout", handleFocusChange);

    return () => {
      cancelarListener();
      observer.disconnect();
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChange);
      if (debounceRef) clearTimeout(debounceRef);
    };
  }, [history]);

  useEffect(() => {
    const handleVoiceCommand = (event: CustomEvent) => {
      const { acao, rota, textoBotao, campo, valor } = event.detail || {};

      if (acao === "NAVEGAR" && rota) {
        history.push(rota);
      }

      if (acao === "PREENCHER_CAMPO" && campo && valor !== undefined) {
        preencherCampo(campo, valor);
      }

      if (acao === "LIMPAR_CAMPO" && campo) {
        preencherCampo(campo, "");
      }

      if (acao === "CLICAR_TEXTO" && textoBotao) {
        const termo = textoBotao.toLowerCase();

        const elementos = Array.from(
          document.querySelectorAll<HTMLElement>(
            "button, a, input[type='submit'], [role='button'], li, .MuiListItem-root"
          )
        );
        const alvo = elementos.find((el) => {
          const texto = el.innerText?.toLowerCase() || "";
          const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() || "";
          const dataTest = el.getAttribute("data-test")?.toLowerCase() || "";

          return (
            texto.includes(termo) ||
            ariaLabel.includes(termo) ||
            dataTest.includes(termo)
          );
        });

        if (alvo) {
          alvo.click();
          console.log(`⚡ Clicou no elemento: "${textoBotao}"`);
        } else {
          console.warn(`⚠️ Elemento com texto '${textoBotao}' não foi encontrado.`);
        }
      }
      if (acao === "ROLAR_BAIXO" || acao === "DESCER_PAGINA") {
        window.scrollBy({ top: 500, behavior: "smooth" });
      }

      if (acao === "ROLAR_CIMA" || acao === "SUBIR_PAGINA") {
        window.scrollBy({ top: -500, behavior: "smooth" });
      }
    };

    window.addEventListener("VOICE_COMMAND" as any, handleVoiceCommand);
    return () => {
      window.removeEventListener("VOICE_COMMAND" as any, handleVoiceCommand);
    };
  }, [history]);

  const isLoggedIn =
    authState.matches("authorized") ||
    authState.matches("refreshing") ||
    authState.matches("updating");

  return (
    <Root className={classes.root}>
      <CssBaseline />

      {/* Container posicionado no meio da tela no canto direito */}
      <div className={classes.voiceWidgetWrapper}>
        <VoiceAssistantInit />
      </div>

      {isLoggedIn && (
        <PrivateRoutesContainer
          isLoggedIn={isLoggedIn}
          notificationsService={notificationsService}
          authService={authService}
          snackbarService={snackbarService}
          bankAccountsService={bankAccountsService}
        />
      )}
      {authState.matches("unauthorized") && (
        <Switch>
          <Route exact path="/signup">
            <SignUpForm authService={authService} />
          </Route>
          <Route exact path="/signin">
            <SignInForm authService={authService} />
          </Route>
          <Route path="/*">
            <Redirect
              to={{
                pathname: "/signin",
              }}
            />
          </Route>
        </Switch>
      )}
      <AlertBar snackbarService={snackbarService} />
    </Root>
  );
};

export default App;
