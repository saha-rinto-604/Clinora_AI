package com.clinora.auth.session;

public class RefreshTokenReuseDetectedException extends RefreshSessionException {

    public RefreshTokenReuseDetectedException() {
        super("Refresh token reuse detected");
    }
}
