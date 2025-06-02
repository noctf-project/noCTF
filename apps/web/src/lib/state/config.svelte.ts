import api from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";

export type SiteConfig = PathResponse<"/site/config", "get">["data"];

export class ConfigState {
  siteConfig?: SiteConfig = $state();

  constructor() {
    this.loadSiteConfig();
  }

  private async loadSiteConfig() {
    const r = await api.GET("/site/config");
    this.siteConfig = r.data?.data;
  }
}

const configState = new ConfigState();
export default configState;
