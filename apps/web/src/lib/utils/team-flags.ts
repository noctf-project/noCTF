export interface TeamFlag {
  name: string;
  color: string;
  icon: string;
}

export const availableFlags: TeamFlag[] = [
  { name: "blocked", color: "badge-error", icon: "material-symbols:block" },
  {
    name: "hidden",
    color: "bg-base-400 text-base-content",
    icon: "material-symbols:visibility-off",
  },
  { name: "frozen", color: "badge-info", icon: "material-symbols:ac-unit" },
];

export function getFlagConfig(flagName: string): TeamFlag {
  return (
    availableFlags.find((f) => f.name === flagName) || {
      name: flagName,
      color: "badge-warning",
      icon: "",
    }
  );
}
