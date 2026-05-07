package se.billigapizzor.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		// Let content draw edge-to-edge while keeping dark status-bar icons disabled.
		WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
		WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
		controller.setAppearanceLightStatusBars(false);
	}
}
