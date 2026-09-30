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
    private final com.clinora.research.service.ResearchSocketAccess access;
    private final java.util.concurrent.ConcurrentMap<String, org.springframework.security.oauth2.jwt.Jwt> sessions = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.concurrent.ConcurrentMap<String, java.util.concurrent.ConcurrentMap<String, String>> subscriptions = new java.util.concurrent.ConcurrentHashMap<>();
    private final CorsProperties cors;
    private final JwtDecoder jwtDecoder;
    private final JdbcTemplate jdbc;
    private final String relayHost;
    private final int relayPort;
    private final String relayUser;
    private final String relayPassword;
    private final String relayVirtualHost;

    public ClinoraWebSocketConfig(
        com.clinora.research.service.ResearchSocketAccess access,
        CorsProperties cors,
        JwtDecoder jwtDecoder,
        JdbcTemplate jdbc,
        @Value("${spring.rabbitmq.host:localhost}") String relayHost,
        @Value("${RABBITMQ_STOMP_PORT:61613}") int relayPort,
        @Value("${spring.rabbitmq.username:clinora}") String relayUser,
        @Value("${spring.rabbitmq.password:change-me}") String relayPassword,
        @Value("${spring.rabbitmq.virtual-host:/}") String relayVirtualHost
    ) {
        this.access = access;
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
                StompHeaderAccessor header = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (header == null || header.getCommand() == null) return message;
                String session = header.getSessionId();
                if (session == null) throw new IllegalArgumentException("WebSocket session required.");
                if (header.getCommand() == StompCommand.CONNECT) {
                    String authorization = first(header.getNativeHeader("Authorization"));
                    if (authorization == null || !authorization.startsWith("Bearer ")) throw new IllegalArgumentException("Authentication required.");
                    var jwt = jwtDecoder.decode(authorization.substring(7));
                    access.account(jwt);
                    header.setUser(converter.convert(jwt));
                    sessions.put(session, jwt);
                    subscriptions.put(session, new java.util.concurrent.ConcurrentHashMap<>());
                    return message;
                }
                if (header.getCommand() == StompCommand.DISCONNECT) { removeSession(session); return message; }
                var jwt = sessions.get(session);
                access.account(jwt);
                if (header.getCommand() == StompCommand.SUBSCRIBE) {
                    access.destination(jwt, header.getDestination(), false);
                    if (header.getSubscriptionId() == null) throw new IllegalArgumentException("Subscription identity required.");
                    subscriptions.get(session).put(header.getSubscriptionId(), header.getDestination());
                } else if (header.getCommand() == StompCommand.UNSUBSCRIBE) {
                    if (header.getSubscriptionId() != null) subscriptions.get(session).remove(header.getSubscriptionId());
                } else if (header.getCommand() == StompCommand.SEND) {
                    access.destination(jwt, header.getDestination(), true);
                } else if (header.getCommand() != StompCommand.ACK && header.getCommand() != StompCommand.NACK) {
                    throw new IllegalArgumentException("Unsupported client command.");
                }
                return message;
            }
        });
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                var header = StompHeaderAccessor.wrap(message);
                if (header.getCommand() != StompCommand.MESSAGE) return message;
                String session = header.getSessionId();
                String subscription = header.getSubscriptionId();
                if (session == null || subscription == null) return null;
                var destinations = subscriptions.get(session);
                if (destinations == null) return null;
                try {
                    // Recheck current account, token, membership and document scope for every delivery.
                    access.destination(sessions.get(session), destinations.get(subscription), false);
                    return message;
                } catch (RuntimeException denied) {
                    return null; // No delivery after expiry, removal, suspension or failed authorization lookup.
                }
            }
        });
    }

    @org.springframework.context.event.EventListener
    public void disconnected(org.springframework.web.socket.messaging.SessionDisconnectEvent event) {
        removeSession(event.getSessionId());
    }

    private void removeSession(String session) {
        sessions.remove(session);
        subscriptions.remove(session);
    }

    private static String first(List<String> values) {
        return values == null || values.isEmpty() ? null : values.getFirst();
    }
}

