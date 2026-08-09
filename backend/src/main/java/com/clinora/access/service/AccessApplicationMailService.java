package com.clinora.access.service;

import com.clinora.config.EmailProperties;
import com.clinora.notifications.email.EmailDeliveryPort;
import com.clinora.notifications.email.TransactionalEmail;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;

@Service
public class AccessApplicationMailService {
    private final EmailDeliveryPort emailDeliveryPort;
    private final EmailProperties emailProperties;

    public AccessApplicationMailService(EmailDeliveryPort emailDeliveryPort, EmailProperties emailProperties) {
        this.emailDeliveryPort=emailDeliveryPort; this.emailProperties=emailProperties;
    }

    public void sendVerification(String to,String firstName,String rawToken) {
        String link=link("/application/email-verification",rawToken);
        send(to,"Verify your Clinora professional application",
            "Hi "+firstName+", verify your application email: "+link,
            "<p>Hi "+escape(firstName)+",</p><p>Verify this email before continuing your Clinora professional access application.</p><p><a href=\""+link+"\">Verify application email</a></p><p>This link is single-use and expires automatically.</p>");
    }

    public void sendAccessLink(String to,String firstName,String rawToken) {
        String link=link("/application/status",rawToken);
        send(to,"Resume your Clinora professional application",
            "Hi "+firstName+", securely resume your application: "+link,
            "<p>Hi "+escape(firstName)+",</p><p>Use this single-use link to resume your professional application.</p><p><a href=\""+link+"\">Resume application</a></p>");
    }

    public void sendSubmitted(String to,String firstName) {
        send(to,"Clinora application submitted","Hi "+firstName+", your professional access application has been submitted for review.",
            "<p>Hi "+escape(firstName)+",</p><p>Your professional access application has been submitted. Submission does not grant a Clinora professional role. We will contact you when review activity requires your attention.</p>");
    }

    public void sendWithdrawn(String to,String firstName) {
        send(to,"Clinora application withdrawn","Hi "+firstName+", your professional access application has been withdrawn.",
            "<p>Hi "+escape(firstName)+",</p><p>Your professional access application has been withdrawn.</p>");
    }

    private void send(String to,String subject,String text,String html){ emailDeliveryPort.send(new TransactionalEmail(to,subject,text,html)); }
    private String link(String path,String token){String base=emailProperties.getFrontendUrl().replaceAll("/+$","");return base+path+"?token="+URLEncoder.encode(token, StandardCharsets.UTF_8);}
    private String escape(String value){return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
}
