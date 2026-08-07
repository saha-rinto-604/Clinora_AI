package com.clinora.security.jwt;

import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public class ClinoraJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String role = jwt.getClaimAsString("role");
        List<SimpleGrantedAuthority> authorities = role == null || role.isBlank()
            ? List.of()
            : List.of(new SimpleGrantedAuthority("ROLE_" + role));
        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }
}
