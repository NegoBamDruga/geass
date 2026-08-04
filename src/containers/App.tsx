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
    transform: "translateY(-50%)",
    zIndex: 9999, 
  },
}));

if (window.Cypress) {
  window.authService = authService;
}

// Função aprimorada para localizar e preencher qualquer input no RWA
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
    console.log(`✅ Campo '${seletorOuNome}' preenchido com: "${valor}"`);
  } else {
    console.warn(`⚠️ Campo '${seletorOuNome}' não foi encontrado na tela.`);
  }
};

const App: React.FC = () => {
  const history = useHistory();
  const [authState] = useActor(authService);

  const [, , notificationsService] = useMachine(notificationsMachine);
  const [, , snackbarService] = useMachine(snackbarMachine);
  const [, , bankAccountsService] = useMachine(bankAccountsMachine);

  useEffect(() => {
    const handleVoiceCommand = (event: CustomEvent) => {
      const { acao, rota, textoBotao, campo, valor } = event.detail || {};

      if (acao === "NAVEGAR" && rota) {
        history.push(rota);
      }

      if (acao === "PREENCHER_CAMPO" && campo && valor !== undefined) {
        preencherCampo(campo, valor);
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