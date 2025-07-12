import { ServiceCradle } from "@noctf/server-core";
import { SupportSpec, TicketConfig } from "./schema/config.ts";
import { NotFoundError } from "@noctf/server-core/errors";

export enum RequesterType {
  USER = "user",
  TEAM = "team",
}

export interface SupportSpecProvider {
  get(item: string): Promise<SupportSpec>;
}

export class SupportSpecFactory {
  private readonly providers = new Map<string, SupportSpecProvider>();

  constructor(cradle: ServiceCradle) {
    this.providers.set(
      "config",
      new ConfigSupportSpecProvider(cradle.configService),
    );
    this.providers.set(
      "challenge",
      new ChallengeSupportSpecProvider(cradle.challengeService),
    );
  }

  async get(category: string, item: string) {
    const provider = this.providers.get(category);
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return provider.get(item);
  }
}

export class ConfigSupportSpecProvider implements SupportSpecProvider {
  constructor(private readonly configService: ServiceCradle["configService"]) {}

  async get(item: string): Promise<SupportSpec> {
    const cfg = await this.configService.get(TicketConfig);
    const spec = cfg.value.support_specs[item];
    if (!spec || !cfg.value.support_specs.hasOwnProperty(item)) {
      throw new NotFoundError("Item not found");
    }
    return { ...spec, id: item };
  }
}

export class ChallengeSupportSpecProvider implements SupportSpecProvider {
  constructor(
    private readonly challengeService: ServiceCradle["challengeService"],
  ) {}

  async get(item: string): Promise<SupportSpec> {
    let challenge;
    try {
      challenge = await this.challengeService.get(item);
    } catch (e) {
      if (e instanceof NotFoundError) throw new NotFoundError("Item not found");
    }
    return {
      id: challenge.slug,
      name: challenge.title,
      requester: "team",
      can_open:
        challenge.tags.tickets !== "false" &&
        !challenge.hidden &&
        (!challenge.visible_at || challenge.visible_at > new Date()),
    };
  }
}
