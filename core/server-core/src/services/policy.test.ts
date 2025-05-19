import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { PolicyDAO } from "../dao/policy.ts";
import { UserDAO } from "../dao/user.ts";
import { Evaluate } from "../util/policy.ts";
import { UserFlag } from "../types/enums.ts";
import { PolicyService } from "./policy.ts";
import { ServiceCradle } from "../index.ts";
import { PolicyDocument } from "@noctf/api/datatypes";
import { AuthConfig } from "@noctf/api/config";

vi.mock(import("../dao/policy.ts"));
vi.mock(import("../dao/user.ts"));
vi.mock(import("../util/policy.ts"));

describe(PolicyService, () => {
  const databaseClient = mockDeep<ServiceCradle["databaseClient"]>();
  const logger = mockDeep<ServiceCradle["logger"]>();
  const configService = mockDeep<ServiceCradle["configService"]>();

  const mockPolicyDAO = mockDeep<PolicyDAO>();
  const mockUserDAO = mockDeep<UserDAO>();

  let policyService: PolicyService;

  beforeEach(() => {
    mockReset(databaseClient);
    mockReset(logger);
    mockReset(configService);
    mockReset(mockPolicyDAO);
    mockReset(mockUserDAO);

    vi.mocked(PolicyDAO).mockImplementation(() => mockPolicyDAO);
    vi.mocked(UserDAO).mockImplementation(() => mockUserDAO);

    policyService = new PolicyService({
      databaseClient,
      logger,
      configService,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe(PolicyService.prototype.getPoliciesForUser, () => {
    it("should return filtered policies based on user roles", async () => {
      // Setup test data
      const userId = 123;
      const userRoles = new Set(["user", "admin"]);
      const mockPolicies: PolicyDocument[] = [
        {
          id: 1,
          name: "Policy1",
          description: "",
          match_roles: ["user"],
          omit_roles: [],
          permissions: [],
          public: false,
          is_enabled: true,
        },
        {
          id: 2,
          name: "Policy2",
          description: "",
          match_roles: ["admin"],
          omit_roles: [],
          permissions: [],
          public: false,
          is_enabled: true,
        },
        {
          id: 3,
          name: "Policy3",
          description: "",
          match_roles: ["user"],
          omit_roles: ["admin"],
          permissions: [],
          public: false,
          is_enabled: true,
        },
        {
          id: 4,
          name: "Policy4",
          description: "",
          match_roles: [],
          omit_roles: [],
          permissions: [],
          public: true,
          is_enabled: true,
        },
      ];

      mockUserDAO.getFlagsAndRoles.mockResolvedValue({
        roles: Array.from(userRoles),
        flags: [UserFlag.VALID_EMAIL],
      });

      mockPolicyDAO.listPolicies.mockResolvedValue(mockPolicies);

      const result = await policyService.getPoliciesForUser(userId);

      expect(mockUserDAO.getFlagsAndRoles).toHaveBeenCalledWith(userId);
      expect(mockPolicyDAO.listPolicies).toHaveBeenCalledWith({
        is_enabled: true,
      });

      // Should include Policy1 (matches 'user') and Policy4 (empty match_roles)
      // Should exclude Policy3 (omitted by 'admin')
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(expect.objectContaining({ id: 1 }));
      expect(result).toContainEqual(expect.objectContaining({ id: 2 }));
      expect(result).toContainEqual(expect.objectContaining({ id: 4 }));
    });
  });

  describe(PolicyService.prototype.getRolesForUser, () => {
    it("should not add an active role if email validation is on and user is not validated", async () => {
      (configService.get<AuthConfig>).mockResolvedValue({
        value: { validate_email: true },
        version: 1,
      });
      mockUserDAO.getFlagsAndRoles.mockResolvedValue({
        roles: ["user"],
        flags: [],
      });
      const result = await policyService.getRolesForUser(1);
      expect(result).toEqual(new Set<string>(["user"]));
    });

    it("should add an active role if email validation is on and user is validated", async () => {
      (configService.get<AuthConfig>).mockResolvedValue({
        value: { validate_email: true },
        version: 1,
      });
      mockUserDAO.getFlagsAndRoles.mockResolvedValue({
        roles: ["user"],
        flags: [UserFlag.VALID_EMAIL],
      });
      const result = await policyService.getRolesForUser(1);
      expect(result).toEqual(new Set<string>(["user", "active"]));
    });

    it.each([true, false])(
      "should replace active with blocked if user is blocked",
      async (validate_email) => {
        (configService.get<AuthConfig>).mockResolvedValueOnce({
          value: { validate_email },
          version: 1,
        });
        mockUserDAO.getFlagsAndRoles.mockResolvedValue({
          roles: ["user"],
          flags: [UserFlag.BLOCKED].concat(
            validate_email ? [UserFlag.VALID_EMAIL] : [],
          ),
        });
        const result = await policyService.getRolesForUser(1);
        expect(result).toEqual(new Set<string>(["user", "blocked"]));
      },
    );
  });

  describe("getPoliciesForPublic", () => {
    it("should return only public policies", async () => {
      // Setup test data
      const mockPolicyDocuments: PolicyDocument[] = [
        {
          id: 1,
          name: "PrivatePolicy",
          description: "",
          match_roles: [],
          omit_roles: [],
          permissions: [],
          public: false,
          is_enabled: true,
        },
        {
          id: 2,
          name: "PublicPolicy1",
          description: "",
          match_roles: [],
          omit_roles: [],
          permissions: [],
          public: true,
          is_enabled: true,
        },
        {
          id: 3,
          name: "PublicPolicy2",
          description: "",
          match_roles: [],
          omit_roles: [],
          permissions: [],
          public: true,
          is_enabled: true,
        },
      ];

      // Setup mocks
      mockPolicyDAO.listPolicies.mockResolvedValue(mockPolicyDocuments);

      // Execute
      const result = await policyService.getPoliciesForPublic();

      // Verify
      expect(mockPolicyDAO.listPolicies).toHaveBeenCalledWith({
        is_enabled: true,
      });
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(expect.objectContaining({ id: 2 }));
      expect(result).toContainEqual(expect.objectContaining({ id: 3 }));
    });
  });

  describe(PolicyService.prototype.evaluate, () => {
    it("should return true if any policy evaluation passes for a user", async () => {
      const userId = 789;
      const mockUserPolicies: PolicyDocument[] = [
        {
          id: 1,
          name: "UserPolicy1",
          description: "",
          permissions: [],
          match_roles: [],
          omit_roles: [],
          public: false,
          is_enabled: true,
        },
        {
          id: 2,
          name: "UserPolicy2",
          description: "",
          permissions: [],
          match_roles: [],
          omit_roles: [],
          public: false,
          is_enabled: true,
        },
      ];

      vi.mocked(Evaluate).mockReturnValueOnce(false).mockReturnValueOnce(true);
      mockPolicyDAO.listPolicies.mockResolvedValue(mockUserPolicies);

      const result = await policyService.evaluate(userId, ["OR", "dummy"]);

      expect(Evaluate).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it("should return false if no policy evaluation passes for a user", async () => {
      const userId = 790;
      const mockUserPolicies: PolicyDocument[] = [
        {
          id: 1,
          name: "UserPolicy1",
          description: "",
          permissions: [],
          match_roles: [],
          omit_roles: [],
          public: false,
          is_enabled: true,
        },
        {
          id: 2,
          name: "UserPolicy2",
          description: "",
          permissions: [],
          match_roles: [],
          omit_roles: [],
          public: false,
          is_enabled: true,
        },
      ];

      vi.mocked(Evaluate).mockReturnValue(false);
      mockPolicyDAO.listPolicies.mockResolvedValue(mockUserPolicies);

      const result = await policyService.evaluate(userId, ["OR", "dummy"]);

      expect(Evaluate).toHaveBeenCalledTimes(2);
      expect(result).toBe(false);
    });

    it("should use public policies when userId is falsy", async () => {
      const mockPolicies: PolicyDocument[] = [
        {
          id: 1,
          name: "PublicPolicy",
          description: "",
          permissions: ["dummy.1"],
          match_roles: [],
          omit_roles: [],
          public: false,
          is_enabled: true,
        },
        {
          id: 2,
          name: "PublicPolicy",
          description: "",
          permissions: ["dummy.2"],
          match_roles: [],
          omit_roles: [],
          public: true,
          is_enabled: true,
        },
      ];

      vi.mocked(Evaluate).mockReturnValue(true);
      mockPolicyDAO.listPolicies.mockResolvedValue(mockPolicies);

      const result = await policyService.evaluate(0, ["dummy"]);

      expect(Evaluate).toHaveBeenCalledTimes(1);
      expect(Evaluate).toHaveBeenCalledWith(["dummy"], ["dummy.2"]);
      expect(result).toBe(true);
    });
  });
});
