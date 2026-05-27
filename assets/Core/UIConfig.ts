import { UIID, UILayer } from './Enum';
import type { UIConfigData } from './Enum';
import { createMainPanel } from '../MainPanel';
import { createWinPanel } from '../WinPanel';
import { createFailPanel } from '../FailPanel';
import { createPopupPanel } from '../PopupPanel';
import { createSurvivalOverPanel } from '../SurvivalOverPanel';
import { createSettingPanel } from '../SettingPanel';
import { createPowerPanel } from '../PowerPanel';
import { createGuidePanel } from '../GuidePanel';
import { createSkinPanel } from '../SkinPanel';
import { createRankPanel } from '../RankPanel';
import { createDailyChallengeOverPanel } from '../DailyChallengeOverPanel';
import { createPrivacyPanel } from '../PrivacyPanel';
import { createAntiAddictionPanel } from '../AntiAddictionPanel';

export const UIConfigMap: Partial<Record<UIID, UIConfigData>> = {
    [UIID.MainPanel]: { uiId: UIID.MainPanel, layer: UILayer.UI, factory: createMainPanel },
    [UIID.WinPanel]: { uiId: UIID.WinPanel, layer: UILayer.UI, factory: createWinPanel },
    [UIID.FailPanel]: { uiId: UIID.FailPanel, layer: UILayer.UI, factory: createFailPanel },
    [UIID.PopupPanel]: { uiId: UIID.PopupPanel, layer: UILayer.Popup, factory: createPopupPanel },
    [UIID.SurvivalOverPanel]: { uiId: UIID.SurvivalOverPanel, layer: UILayer.UI, factory: createSurvivalOverPanel },
    [UIID.SettingPanel]: { uiId: UIID.SettingPanel, layer: UILayer.Popup, factory: createSettingPanel },
    [UIID.PowerPanel]: { uiId: UIID.PowerPanel, layer: UILayer.Popup, factory: createPowerPanel },
    [UIID.GuidePanel]: { uiId: UIID.GuidePanel, layer: UILayer.Popup, factory: createGuidePanel },
    [UIID.SkinPanel]: { uiId: UIID.SkinPanel, layer: UILayer.Popup, factory: createSkinPanel },
    [UIID.RankPanel]: { uiId: UIID.RankPanel, layer: UILayer.Popup, factory: createRankPanel },
    [UIID.DailyChallengeOverPanel]: { uiId: UIID.DailyChallengeOverPanel, layer: UILayer.UI, factory: createDailyChallengeOverPanel },
    [UIID.PrivacyPanel]: { uiId: UIID.PrivacyPanel, layer: UILayer.Popup, factory: createPrivacyPanel },
    [UIID.AntiAddictionPanel]: { uiId: UIID.AntiAddictionPanel, layer: UILayer.Popup, factory: createAntiAddictionPanel },
};
