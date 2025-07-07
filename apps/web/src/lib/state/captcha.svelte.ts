import api from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";
import type { Middleware } from "openapi-fetch";

export type CaptchaConfig = PathResponse<"/captcha", "get">["data"];

export class CaptchaState {
  config?: CaptchaConfig = $state();
  show: boolean = $state(false);

  resolve?: (r: string) => void;
  reject?: (r: unknown) => void;

  constructor() {
    this.load();
  }

  async request() {
    return new Promise<string>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.show = true;
    });
  }

  onSuccess(response: string) {
    const f = this.resolve;
    this.resolve = undefined;
    this.reject = undefined;
    this.show = false;
    f?.(response);
  }

  onError(e: unknown) {
    const f = this.reject;
    this.resolve = undefined;
    this.reject = undefined;
    this.show = false;
    f?.(e);
  }

  private async load() {
    const { data, error } = await api.GET("/captcha");
    if (error) {
      throw new Error("Error loading captcha widget");
    }
    this.config = data.data;
  }
}

const captchaState = new CaptchaState();
export default captchaState;
const captchaMiddleware: Middleware = {
  async onRequest({ request, schemaPath }) {
    const path = schemaPath.replace(/{([a-zA-Z0-9_-]+)}/g, ":$1");
    if (
      captchaState.config?.routes.some(
        (x) => x.method === request.method && x.path === path,
      )
    ) {
      const response = await captchaState.request();
      request.headers.append("x-noctf-captcha", response);
    }
    return request;
  },
};
api.use(captchaMiddleware);
