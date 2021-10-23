import services from "../services";
import CacheService from "../services/cache";
import DatabaseService from "../services/database";
import { now } from "../util/helpers";
import ChallengeDAO, { Attachment, Challenge, ChallengeSolve, Hint } from "./Challenge";

export type PlayerChallenge = Omit<Challenge, 'display_at'>;
export type PlayerHint = Hint;
export type PlayerAttachment = Attachment;
export type PlayerChallengeSolve = Omit<ChallengeSolve, 'flag_id'  | 'submission'>;

/**
 * Provides a interface for players to view challenges.
 * 
 * This should enforce rules such as `display_at` based masking.
 */
export class PlayerChallengeDAO {
    constructor(private database: DatabaseService, private cache: CacheService) {
    }

    public async listVisibleChallenges(): Promise<PlayerChallenge[]> {
        return (await ChallengeDAO.listChallenges()).filter(chal => this.filterChallenge(chal));
    }

    public async getChallengeById(id: number): Promise<PlayerChallenge | null> {
        const chal = await ChallengeDAO.getChallengeById(id);
        return chal ? this.filterChallenge(chal) : null;
    }

    public async getChallengeSolves(id: number): Promise<PlayerChallengeSolve[]> {
        const solves = await ChallengeDAO.getChallengeSolves(id);
        return solves.map(solve => ({
            submitter: solve.submitter,
            submitted_at: solve.submitted_at,
            challenge_id: id,
        }));
    }

    public async makeAndCheckSubmission(userId: number, challengeId: number, submission: string): Promise<boolean> {
        await ChallengeDAO.makeSubmission(userId, challengeId, submission);
        return await ChallengeDAO.checkSubmission(challengeId, submission);
    }

    public async listChallengeHints(userId: number, challengeId: number): Promise<PlayerHint[]> {
        const challengeHints = await ChallengeDAO.getChallengeHints(challengeId);
        return challengeHints.map((hint) => this.filterHint(hint)).filter((x): x is Hint => x !== null);
    }

    public async getHint(userId: number, hintId: number): Promise<PlayerHint | null> {
        const hint = await ChallengeDAO.getHintById(hintId);
        return hint ? this.filterHint(hint) : null;
    }


    private filterHint(rawHint: Hint): PlayerHint | null {
        return rawHint.released_at === null || rawHint.released_at > now() ? null : rawHint;
    }

    private filterChallenge(challenge: Challenge): Challenge | null {
        return challenge.display_at === null || challenge.display_at > now() ? null : challenge;
    }
}

export default new PlayerChallengeDAO(services.database, services.cache);
