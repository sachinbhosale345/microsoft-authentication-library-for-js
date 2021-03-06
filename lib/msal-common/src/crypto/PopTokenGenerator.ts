/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICrypto } from "./ICrypto";
import { AuthToken } from "../account/AuthToken";
import { TokenClaims } from "../account/TokenClaims";
import { TimeUtils } from "../utils/TimeUtils";
import { UrlString } from "../url/UrlString";
import { IUri } from "../url/IUri";

/**
 * See eSTS docs for more info.
 * - A kid element, with the value containing an RFC 7638-compliant JWK thumbprint that is base64 encoded.
 * -  xms_ksl element, representing the storage location of the key's secret component on the client device. One of two values:
 *      - sw: software storage
 *      - uhw: hardware storage
 */
type ReqCnf = {
    kid: string;
    xms_ksl: KeyLocation;
};

enum KeyLocation {
    SW = "sw",
    UHW = "uhw"
}

export class PopTokenGenerator {

    private cryptoUtils: ICrypto;

    constructor(cryptoUtils: ICrypto) {
        this.cryptoUtils = cryptoUtils;
    }

    async generateCnf(resourceRequestMethod: string, resourceRequestUri: string): Promise<string> {
        const kidThumbprint = await this.cryptoUtils.getPublicKeyThumbprint(resourceRequestMethod, resourceRequestUri);
        const reqCnf: ReqCnf = {
            kid: kidThumbprint,
            xms_ksl: KeyLocation.SW
        };
        return this.cryptoUtils.base64Encode(JSON.stringify(reqCnf));
    }

    async signPopToken(accessToken: string, resourceRequestMethod: string, resourceRequestUri: string): Promise<string> {
        const tokenClaims: TokenClaims = AuthToken.extractTokenClaims(accessToken, this.cryptoUtils);
        const resourceUrlString: UrlString = new UrlString(resourceRequestUri);
        const resourceUrlComponents: IUri = resourceUrlString.getUrlComponents();
        return await this.cryptoUtils.signJwt({
            at: accessToken,
            ts: `${TimeUtils.nowSeconds()}`,
            m: resourceRequestMethod.toUpperCase(),
            u: resourceUrlComponents.HostNameAndPort || "",
            nonce: this.cryptoUtils.createNewGuid(),
            p: resourceUrlComponents.AbsolutePath,
            q: [[], resourceUrlComponents.QueryString],
        }, tokenClaims.cnf.kid);
    }
}
