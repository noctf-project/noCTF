import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
  const teamId = Number(params.id);
  if (isNaN(teamId)) {
    error(404, "Not found");
  }
  return {
    teamId,
  };
};
