import { goto } from "$app/navigation";
import api, { SESSION_TOKEN_KEY } from "$lib/api/index.svelte";
import authState from "$lib/state/auth.svelte";
import { toasts } from "$lib/stores/toast";

class LoginState {
  email: string = $state("");
  username: string = $state("");
  password: string = $state("");
  rememberMe: boolean = $state(false);
  registrationToken: string = $state("");

  // OAuth params
  urlParams = new URLSearchParams(window.location.search);
  clientId = this.urlParams.get("client_id");
  redirectUri = this.urlParams.get("redirect_uri");
  scope = this.urlParams.get("scope");
  state = this.urlParams.get("state");
  responseType = this.urlParams.get("response_type");

  async checkEmail() {
    const checkEmailRes = await api.POST("/auth/email/init", {
      body: { email: this.email },
    });

    if (checkEmailRes.error) {
      if (checkEmailRes.error.error === "EmailVerificationRequired") {
        goto("/auth/verify" + window.location.search);
        return;
      } else if (checkEmailRes.error.error === "NotFoundError") {
        goto("/auth/register" + window.location.search);
        return;
      }
      toasts.error(
        checkEmailRes.error.message ??
          "An unexpected error occurred when validating email. Please try again later.",
      );

      return;
    }

    goto("/auth/login" + window.location.search);
  }

  async verifyEmail() {
    const res = await api.POST("/auth/email/verify", {
      body: { email: loginState.email },
    });
    if (res.error) {
      throw new Error(
        res.error.message ??
          "An unexpected error occurred when validating email. Please try again later.",
      );
    } else {
      if (res.data?.data?.token) {
        this.registrationToken = res.data.data.token;
        goto("/auth/register" + window.location.search);
      }
    }
  }

  async login() {
    const loginRes = await api.POST("/auth/email/finish", {
      body: {
        email: this.email,
        password: this.password,
        remember: this.rememberMe,
      },
    });

    if (loginRes.error) {
      toasts.error(
        loginRes.error.message ??
          "An unexpected error occurred when logging in. Please try again later.",
      );
      return false;
    }
    if (loginRes.data?.data?.type === "session") {
      localStorage.setItem(SESSION_TOKEN_KEY, loginRes.data.data.token);
      await authState.refresh();
      const redirectTo = new URLSearchParams(window.location.search).get(
        "redirect_to",
      );
      goto(redirectTo || "/").catch(() => goto("/"));
    } else {
      toasts.error("Login failed");
    }
  }

  async register() {
    if (!this.username.trim()) {
      toasts.error("Please enter a username");
      return;
    }

    // if there is no registration token, request one from the server
    if (!this.registrationToken) {
      const verifyRes = await api.POST("/auth/email/verify", {
        body: { email: loginState.email },
      });
      // it is fatal if we don't get a token here since it is needed to register
      if (!verifyRes.data?.data?.token) {
        toasts.error(
          "An error occured during registration. Please try again later.",
        );
        return;
      }

      this.registrationToken = verifyRes.data.data.token;
    }

    const registerRes = await api.POST("/auth/register/finish", {
      body: {
        token: this.registrationToken,
        name: this.username.trim(),
        email: this.email, // this email doesn't actually matter since the backend should use the token to get the email
        password: this.password,
        captcha: "", // Assuming captcha is handled elsewhere or not needed here
      },
    });

    if (registerRes.error) {
      const message = registerRes.error.message?.includes("must match pattern")
        ? "Name contains invalid characters"
        : registerRes.error.message;
      toasts.error(
        message ||
          "An error occured during registration. Please try again later.",
      );
      console.error(registerRes.error);
    }

    if (registerRes.data?.data?.type === "session") {
      toasts.success("Account created successfully!");
      localStorage.setItem(SESSION_TOKEN_KEY, registerRes.data.data.token);
      authState.refresh();
      goto("/team");
      return true;
    } else {
      toasts.error("Registration failed");
    }
  }

  async verifyToken(token: string) {
    const response = await api.POST("/auth/register/token", {
      body: { token },
    });

    if (response.error) {
      console.error("Token verification failed:", response.error);
      const errorMessage =
        response.error?.message || "Invalid or expired registration link.";
      toasts.error(errorMessage);
      goto("/auth" + window.location.search);
      return;
    }

    // TODO: We can have multiple identities?
    if (response?.data?.data?.identity[0]?.provider_id) {
      const email = response.data.data.identity[0].provider_id;
      this.email = email;
      this.registrationToken = token;
    }
    // TODO: Handle when there is no error, but no provider?
  }
}

const loginState = new LoginState();
export default loginState;
