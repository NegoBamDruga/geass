import React from "react";
import ReactDOM from "react-dom";
import { Router } from "react-router-dom";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { VoiceAssistantInit } from "./components/VoiceAssistantInit";
import App from "./containers/App";
import { history } from "./utils/historyUtils";


const theme = createTheme({
  palette: {
    secondary: {
      main: "#fff",
    },
  },
  typography: {
    fontSize: 14 * 0.875,
    body1: {
      lineHeight: 1.43,
      letterSpacing: "0.01071em",
    },
  },

  overrides: {
    MuiOutlinedInput: {
      input: {
        padding: "6px 0 7px",
      },
    },
    MuiInputBase: {
      input: {
        padding: "6px 0 7px",
      },
    },
  },
});

ReactDOM.render(
  <Router history={history}>
    <ThemeProvider theme={theme}>
      <VoiceAssistantInit />
      <App />
    </ThemeProvider>
  </Router>,
  document.getElementById("root")
);