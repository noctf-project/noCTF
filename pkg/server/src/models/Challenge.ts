import services from "../services";
import CacheService from "../services/cache";
import DatabaseService from "../services/database";
import { IndexedObject, UnixTimestamp, UpsertTrackedObject } from "./Common";

export type Challenge = IndexedObject & UpsertTrackedObject & {
    name: string;
    category: string;
    description: string;
    attachments: Attachment[];
    score_initial: number;
    score_decay: number;
    score_minimum: number;
    display_at: UnixTimestamp | null;
};

export type Flag = IndexedObject & UpsertTrackedObject & {
    flag: string | RegExp;
};

export type Hint = IndexedObject & UpsertTrackedObject & {
    hint: string;
    attachments: Attachment[];
    released_at: UnixTimestamp;
};

export type Attachment = {
    name: string;
    uri: string;
};

export type ChallengeSolve = {
    flag_id: number;
    challenge_id: number;
    submission: string;
    submitter: number;
    submitted_at: UnixTimestamp;
};


/**
 * A interface for working with challenges.
 * 
 * This class provides full access - player interactions should be handled by the PlayerChallengeDAO
 */
export class ChallengeDAO {
    private challengeTableName = 'challenges';
    private flagTableName = 'flags';
    private hintsTableName = 'hints';
    private submissionsTableName = 'submissions';
    private solvesViewName = 'challenge_solves';

    constructor(private database: DatabaseService, private cache: CacheService) {
    }

    // TODO: paginate
    async listChallenges(): Promise<Challenge[]> {
        return this.database.builder(this.challengeTableName).select('*');
    }

    async getChallengeById(id: number): Promise<Challenge | null> {
        return this.cache.computeIfAbsent(`challenges:${id}`, () => this.database.builder(this.challengeTableName)
            .select('*')
            .where({ id })
            .first());
    }

    async getChallengeSolves(id: number): Promise<ChallengeSolve[]> {
        return this.cache.computeIfAbsent(`challenge_solves:${id}`, () => this.database.builder(this.solvesViewName)
            .select('*')
            .where({
                challenge_id: id
            })
        , 60);
    }

    async getChallengeHints(challengeId: number): Promise<Hint[]> {
        return await this.database.builder(this.hintsTableName).select('*').where({ challenge_id: challengeId });
    }

    async getHintById(hintId: number): Promise<Hint | null> {
        return await this.database.builder(this.hintsTableName).where({ id: hintId }).first();
    }

    async makeSubmission(userId: number, challengeId: number, submission: string) {
        await this.database.builder(this.submissionsTableName).insert({
            submission,
            submitter: userId,
            challenge_id: challengeId
        });
        await this.cache.purge(`challenge_solves:${challengeId}`);
    }

    async checkSubmission(challengeId: number, submission: string): Promise<boolean> {
        return await this.database.builder(this.flagTableName)
            .select('*')
            .where({
                challenge_id: challengeId,
                submission
            }).first() !== null;
    }
}

export default new ChallengeDAO(services.database, services.cache);
