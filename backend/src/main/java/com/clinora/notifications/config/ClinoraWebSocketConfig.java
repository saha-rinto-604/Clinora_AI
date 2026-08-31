package com.clinora.notifications.config;

import com.clinora.config.CorsProperties;
import com.clinora.security.jwt.ClinoraJwtAuthenticationConverter;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class ClinoraWebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final CorsProperties cors;
    private final JwtDecoder jwtDecoder;
    private final JdbcTemplate jdbc;
    private final String relayHost;
    private final int relayPort;
    private final String relayUser;
    private final String relayPassword;
    private final String relayVirtualHost;

    public ClinoraWebSocketConfig(
        CorsProperties cors,
        JwtDecoder jwtDecoder,
        JdbcTemplate jdbc,
        @Value("${spring.rabbitmq.host:localhost}") String relayHost,
        @Value("${RABBITMQ_STOMP_PORT:61613}") int relayPort,
        @Value("${spring.rabbitmq.username:clinora}") String relayUser,
        @Value("${spring.rabbitmq.password:change-me}") String relayPassword,
        @Value("${spring.rabbitmq.virtual-host:/}") String relayVirtualHost
    ) {
        this.cors = cors;
        this.jwtDecoder = jwtDecoder;
        this.jdbc = jdbc;
        this.relayHost = relayHost;
        this.relayPort = relayPort;
        this.relayUser = relayUser;
        this.relayPassword = relayPassword;
        this.relayVirtualHost = relayVirtualHost;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOrigins(cors.getAllowedOrigins().toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.enableStompBrokerRelay("/queue", "/topic")
            .setRelayHost(relayHost)
            .setRelayPort(relayPort)
            .setClientLogin(relayUser)
            .setClientPasscode(relayPassword)
            .setSystemLogin(relayUser)
            .setSystemPasscode(relayPassword)
            .setVirtualHost(relayVirtualHost);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        ClinoraJwtAuthenticationConverter converter = new ClinoraJwtAuthenticationConverter();
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || accessor.getCommand() == null) return message;
                if (accessor.getCommand() == StompCommand.CONNECT) {
                    String authorization = first(accessor.getNativeHeader("Authorization"));
                    if (authorization == null || !authorization.startsWith("Bearer ")) {
                        throw new IllegalArgumentException("Authenticated WebSocket connection required.");
                    }
                    var jwt = jwtDecoder.decode(authorization.substring(7));
                    UUID userId;
                    try {
                        userId = UUID.fromString(jwt.getSubject());
                    } catch (RuntimeException exception) {
                        throw new IllegalArgumentException("Authenticated WebSocket identity is invalid.");
                    }
                    Integer activePatient = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
                        Integer.class,
                        userId
                    );
                    if (activePatient == null || activePatient != 1) {
                        throw new IllegalArgumentException("An active Patient account is required for notifications.");
                    }
                    accessor.setUser(converter.convert(jwt));
                    return message;
                }
                if (accessor.getCommand() == StompCommand.SUBSCRIBE) {
                    if (accessor.getUser() == null) {
                        throw new IllegalArgumentException("Authenticated WebSocket session required.");
                    }
                    String destination = accessor.getDestination();
                    if (!"/user/queue/notifications".equals(destination)) {
                        throw new IllegalArgumentException("WebSocket subscription is not permitted.");
                    }
                }
                if (accessor.getCommand() == StompCommand.SEND) {
                    throw new IllegalArgumentException("Client messaging is not enabled.");
                }
                return message;
            }
        });
    }

    private static String first(List<String> values) {
        return values == null || values.isEmpty() ? null : values.getFirst();
    }
}

