package com.offlineblindchess.app;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AndroidSystemBarInsetsTest {

    @Test
    public void webContentStartsBelowTopSystemInsets() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            scenario.onActivity(activity -> {
                View decor = activity.getWindow().getDecorView();
                WindowInsetsCompat windowInsets = ViewCompat.getRootWindowInsets(decor);
                assertNotNull("Window insets should be available after launch", windowInsets);

                Insets topSystemInsets = windowInsets.getInsets(
                        WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout());
                assertTrue("The status bar should have a visible inset", topSystemInsets.top > 0);

                View webView = activity.getBridge().getWebView();
                int[] webViewLocation = new int[2];
                webView.getLocationOnScreen(webViewLocation);

                assertTrue(
                        "Web content must be laid out below the top system insets",
                        webViewLocation[1] >= topSystemInsets.top);
            });
        }
    }
}
