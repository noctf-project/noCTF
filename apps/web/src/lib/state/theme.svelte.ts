class ThemeState {
  currentTheme = $state("dark");

  constructor() {
    this.initialize();
  }

  initialize() {
    const storedTheme = localStorage.getItem("theme");
    this.currentTheme = storedTheme || "dark";
    document.documentElement.setAttribute("data-theme", this.currentTheme);
  }

  updateTheme(theme: "dark" | "light"): void {
    this.currentTheme = theme;
    localStorage.setItem("theme", this.currentTheme);
    document.documentElement.setAttribute("data-theme", this.currentTheme);
  }

  toggleTheme(): void {
    this.currentTheme = this.currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", this.currentTheme);
    document.documentElement.setAttribute("data-theme", this.currentTheme);
  }
}

const themeState = new ThemeState();
export default themeState;
