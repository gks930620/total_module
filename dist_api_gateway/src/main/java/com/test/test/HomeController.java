package com.test.test;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping({
            "/",
            "/login",
            "/signup",
            "/mypage",
            "/community",
            "/community/list",
            "/community/write",
            "/community/detail",
            "/community/edit",
            "/rooms",
            "/custom-oauth2/login/success"
    })
    public String forward() {
        return "forward:/index.html";
    }

    @GetMapping("/rooms/{roomId}")
    public String forwardChatRoom() {
        return "forward:/index.html";
    }
}
