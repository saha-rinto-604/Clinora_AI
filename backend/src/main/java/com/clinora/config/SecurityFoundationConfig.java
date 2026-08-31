package com.clinora.config;

import com.clinora.security.jwt.ClinoraJwtAuthenticationConverter;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties({
    AuthProperties.class,
    CorsProperties.class,
    EmailProperties.class,
    AccessApplicationProperties.class,
    ApplicationStorageProperties.class,
    PatientReportStorageProperties.class,
    SystemAdminProperties.class
})
public class SecurityFoundationConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public PasswordEncoder passwordEncoder(AuthProperties authProperties) {
        return new BCryptPasswordEncoder(authProperties.getBcryptStrength());
    }

    @Bean
    public SecretKey jwtSecretKey(AuthProperties authProperties) {
        byte[] secret = authProperties.getJwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 bytes for HS256");
        }
        return new SecretKeySpec(secret, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(jwtSecretKey)
            .algorithm(JWSAlgorithm.HS256)
            .build();
        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(new JWKSet(jwk));
        return new NimbusJwtEncoder(jwkSource);
    }

    @Bean
    public JwtDecoder jwtDecoder(SecretKey jwtSecretKey, AuthProperties authProperties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey)
            .macAlgorithm(MacAlgorithm.HS256)
            .build();
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(),
            new JwtIssuerValidator(authProperties.getIssuer())
        );
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(CorsProperties corsProperties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.getAllowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Idempotency-Key"));
        configuration.setExposedHeaders(List.of());
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        source.registerCorsConfiguration("/ws/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        JwtDecoder jwtDecoder,
        CorsConfigurationSource corsConfigurationSource
    ) throws Exception {
        ClinoraJwtAuthenticationConverter jwtAuthenticationConverter = new ClinoraJwtAuthenticationConverter();

        return http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/health/**", "/v3/api-docs/**", "/swagger-ui/**", "/ws", "/ws/**")
                .permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**")
                .permitAll()
                .requestMatchers(
                    "/api/v1/access-applications/doctor",
                    "/api/v1/access-applications/researcher",
                    "/api/v1/access-applications/verify-email",
                    "/api/v1/access-applications/verify-email/resend",
                    "/api/v1/access-applications/access-link",
                    "/api/v1/access-applications/session",
                    "/api/v1/access-applications/activate",
                    "/api/v1/access-applications/logout",
                    "/api/v1/access-applications/logout-all",
                    "/api/v1/access-applications/me",
                    "/api/v1/access-applications/me/events",
                    "/api/v1/access-applications/me/submit",
                    "/api/v1/access-applications/me/withdraw",
                    "/api/v1/access-applications/me/documents",
                    "/api/v1/access-applications/me/documents/*",
                    "/api/v1/access-applications/me/documents/*/content",
                    "/api/v1/access-applications/me/interview",
                    "/api/v1/access-applications/me/interview/reschedule-request")
                .permitAll()
                .requestMatchers(HttpMethod.POST,
                    "/api/v1/auth/register",
                    "/api/v1/auth/verify-email",
                    "/api/v1/auth/resend-verification",
                    "/api/v1/auth/login",
                    "/api/v1/auth/refresh-token",
                    "/api/v1/auth/forgot-password",
                    "/api/v1/auth/reset-password",
                    "/api/v1/auth/activate-account")
                .permitAll()
                .requestMatchers("/api/v1/admin/**")
                .hasRole("SYSTEM_ADMIN")
                .anyRequest()
                .authenticated())
            .oauth2ResourceServer(oauth -> oauth
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder)
                    .jwtAuthenticationConverter(jwtAuthenticationConverter)))
            .build();
    }
}
