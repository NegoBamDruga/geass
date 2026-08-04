import { NavigateFunction } from "react-router-dom";

class VoiceNavigationManager {
  private navigate: NavigateFunction | null = null;

  public setNavigator(navigateFunc: NavigateFunction) {
    this.navigate = navigateFunc;
  }

  public goTo(path: string) {
    if (this.navigate) {
      this.navigate(path);
    } else {
      console.warn("Navegador de voz não inicializado");
    }
  }

  public clickElementByText(text: string) {

    const elements = Array.from(document.querySelectorAll("button, a, input, [role='button']"));
    const target = elements.find((el) =>
      el.textContent?.toLowerCase().includes(text.toLowerCase())
    );

    if (target) {
      (target as HTMLElement).click();
      console.log(`🤖 Clicou no elemento: ${text}`);
    } else {
      console.warn(`Elemento com texto "${text}" não encontrado.`);
    }
  }
}

export const voiceNav = new VoiceNavigationManager();