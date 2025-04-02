import { SetupConfig } from "@noctf/api/config";
import { ServiceCradle } from "@noctf/server-core";
import { ForbiddenError } from "@noctf/server-core/errors";
import { LocalCache } from "@noctf/server-core/util/local_cache";
import { Policy } from "@noctf/server-core/util/policy";

// TODO: this is better as middleware
export const GetUtils = ({ policyService, configService }: ServiceCradle) => {
  const adminCache = new LocalCache<number, boolean>({ ttl: 1000, max: 5000 });
  const gateStartTime = async (
    policy: Policy,
    ctime: number,
    userId?: number,
  ) => {
    const admin = await adminCache.load(userId || 0, () =>
      policyService.evaluate(userId || 0, policy),
    );
    if (!admin) {
      const {
        value: { active, start_time_s },
      } = await configService.get<SetupConfig>(SetupConfig.$id);
      if (!active) {
        throw new ForbiddenError("The CTF is not currently active");
      }
      if (ctime < start_time_s * 1000) {
        throw new ForbiddenError("The CTF has not started yet");
      }
    }
    return admin;
  };

  return { gateStartTime };
};
