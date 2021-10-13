// A player view of challenges - doesn't have to think about revisions too much

import CacheService from "../services/cache";
import DatabaseService from "../services/database";

//export class PlayerChallengeDAO {
//    private challengeTableName = 'challenges';
//    private challengeRevisionTableName = 'challenge_revisions';
//    private challengeHistoryTableName = 'challenge_history';
//    private flagTableName = 'flags';
//    private hintsTableName = 'hints';
//
//    constructor(private database: DatabaseService, private cache: CacheService) {
//    }
//
//    public async list(): Promise<Challenge[]> {
//
//    }
//
//    public async getLatestById(): Promise<Challenge> {
//
//    }
//}