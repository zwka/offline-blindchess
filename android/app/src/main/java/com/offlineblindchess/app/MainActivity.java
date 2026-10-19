package com.offlineblindchess.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat systemBars =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        systemBars.setAppearanceLightStatusBars(true);
        systemBars.setAppearanceLightNavigationBars(true);

        View webView = getBridge().getWebView();
        View appContent = (View) webView.getParent();
        int initialLeft = appContent.getPaddingLeft();
        int initialTop = appContent.getPaddingTop();
        int initialRight = appContent.getPaddingRight();
        int initialBottom = appContent.getPaddingBottom();

        ViewCompat.setOnApplyWindowInsetsListener(appContent, (view, windowInsets) -> {
            Insets systemBarInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(
                    initialLeft + systemBarInsets.left,
                    initialTop + systemBarInsets.top,
                    initialRight + systemBarInsets.right,
                    initialBottom + systemBarInsets.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(appContent);
    }
}
