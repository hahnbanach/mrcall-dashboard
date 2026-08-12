export default {
    procedure(t, inPhoneNumber, selection, linetype = "mobile") {
        const elements = selection.split("#")
        const name = elements[0];
        const countryAlpha2 = elements[1];
        let phoneNumber = inPhoneNumber
        if (inPhoneNumber.startsWith("+39")) {
            phoneNumber = inPhoneNumber.replace(/^\+39/, "");
        } else if (inPhoneNumber.startsWith("+1")) {
            phoneNumber = inPhoneNumber.replace(/^\+1/, "");
        }
        const proceduresMobile = {
            "fastweb#IT": [
                {
                    "title": "Fastweb",
                    "activationCode": `**004*${phoneNumber}#`,
                    "deactivationCode": `##004#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.officialProcedure')}`,
                                    "href": "https://www.fastweb.it/fastweb-plus/digital-magazine/come-deviare-le-chiamate-con-android-e-ios/"
                                },
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.thisOperatorMayApplyAFee')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryToContactTheOperatorFastweb')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**004*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.doYouWhantToSet')} `
                                },
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.numberOfSecondsBeforeForwarding')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryThisOption', {param: phoneNumber})}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.forInstanceToForward')}`
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}**15#`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "##002#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "tim#IT": [
                {
                    "title": "TIM",
                    "activationCode": `**004*${phoneNumber}#`,
                    "deactivationCode": `##002#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.officialProcedure')}`,
                                    "href": "https://www.sostariffe.it/tariffe-cellulari/guide/trasferimento-di-chiamata-tim-come-deviare-le-telefonate-con-tim"
                                },
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.thisOperatorMayApplyAFee')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `##61#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `##62#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**62*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `##67#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**67*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.doYouWhantToSet')} `
                                },
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.numberOfSecondsBeforeForwarding')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryThisOption', {param: phoneNumber})}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.forInstanceToForward')}`
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}**15#`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "##002#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "IT": [
                {
                    "title": "",
                    "activationCode": `**004*${phoneNumber}#`,
                    "deactivationCode": `##004#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer1')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer2')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**004*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.doYouWhantToSet')} `
                                },
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.numberOfSecondsBeforeForwarding')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryThisOption', {param: phoneNumber})}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.forInstanceToForward')}`
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}**15#`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "##004#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "US": [
                {
                    "title": "",
                    "activationCode": `*68${phoneNumber}`,
                    "deactivationCode": `*81`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer1')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer2')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*68${phoneNumber}`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "*81"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "GB": [
                {
                    "title": "",
                    "activationCode": `**004*${phoneNumber}#`,
                    "deactivationCode": `##004#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer1')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer2')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**004*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.doYouWhantToSet')} `
                                },
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.numberOfSecondsBeforeForwarding')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryThisOption', {param: phoneNumber})}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.forInstanceToForward')}`
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}**15#`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "##004#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ]
        }

        const proceduresFixedLine = {
            "fastweb#IT": [
                {
                    "title": "",
                    "activationCode": `*004*${phoneNumber}#`,
                    "deactivationCode": `#002#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.officialProcedure')}`,
                                    "href": "https://www.fastweb.it/myfastweb/assistenza/guide/trasferimento-di-chiamata"
                                },
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.thisOperatorMayApplyAFee')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryToContactTheOperatorFastweb')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*22*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*23*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.doYouWhantToSet')} `
                                },
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.numberOfSecondsBeforeForwarding')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryThisOption', {param: phoneNumber})}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.forInstanceToForward')}`
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}**15#`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "##004#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "tim#IT": [
                {
                    "title": "TIM",
                    "activationCode": `*004*${phoneNumber}#`,
                    "deactivationCode": `#002#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.officialProcedure')}`,
                                    "href": "https://www.tim.it/assistenza/per-la-tua-linea/trasferimento-di-chiamata"
                                },
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.thisOperatorMayApplyAFee')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*22*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*23*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*24*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "#22#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ", "
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "#23#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ", "
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "#24#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "IT": [
                {
                    "title": "",
                    "activationCode": `*004*${phoneNumber}#`,
                    "deactivationCode": `#004#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer1')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer2')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*004*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.doYouWhantToSet')} `
                                },
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.numberOfSecondsBeforeForwarding')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryThisOption', {param: phoneNumber})}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.forInstanceToForward')}`
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}**15#`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "##004#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "US": [
                {
                    "title": "",
                    "activationCode": `*68${phoneNumber}`,
                    "deactivationCode": `*81`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer1')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer2')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `*68${phoneNumber}`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "*81"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ],
            "GB": [
                {
                    "title": "",
                    "activationCode": `**004*${phoneNumber}#`,
                    "deactivationCode": `##004#`,
                    "middle": {
                        "rows": [
                            [
                                {
                                    "style": "font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer1')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.genericDisclaimer2')}`
                                }
                            ],
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.dialTheNumber')}`,
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**004*${phoneNumber}#`
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.pressTheDialButton')}`
                                }
                            ]
                        ]
                    },
                    "beforeClosing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline;",
                                    "text": `${t('views.onboarding.forwardinggeneric.doYouWhantToSet')} `
                                },
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": `${t('views.onboarding.forwardinggeneric.numberOfSecondsBeforeForwarding')}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.tryThisOption', {param: phoneNumber})}`
                                },
                                {
                                    "style": "",
                                    "text": `${t('views.onboarding.forwardinggeneric.forInstanceToForward')}`
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": `**61*${phoneNumber}**15#`
                                }
                            ]
                        ]
                    },
                    "closing": {
                        "rows": [
                            [
                                {
                                    "style": "display: inline; font-weight: bold;",
                                    "text": t('views.onboarding.forwardinggeneric.deactivation')
                                },
                                {
                                    "style": "display: inline;",
                                    "text": `: ${t('views.onboarding.forwardinggeneric.compose')} `
                                },
                                {
                                    "style": "display: inline;",
                                    "phoneNumberHref": "##004#"
                                },
                                {
                                    "style": "display: inline;",
                                    "text": ` ${t('views.onboarding.forwardinggeneric.andPressDialButton')}`
                                }
                            ]
                        ]
                    }
                }
            ]
        }

        let procedures = proceduresMobile ;
        if(linetype !== "mobile") {
            procedures = proceduresFixedLine
        }
        const key = `${name}#${countryAlpha2}`
        const preferredChoice = procedures[key] ;
        if(! preferredChoice) {
            return procedures[countryAlpha2]
        }
        return preferredChoice ;
    },
    operators(t) {
        const oplist = [
            {name: `Vodafone (${t('isoAlpha2Country.IT')})`, value: 'vodafone#IT'},
            {name: `TIM (${t('isoAlpha2Country.IT')})`, value: 'tim#IT'},
            {name: `Windtre (${t('isoAlpha2Country.IT')})`, value: 'windtre#IT'},
            {name: `Fastweb (${t('isoAlpha2Country.IT')})`, value: 'fastweb#IT'},
            {name: `Iliad (${t('isoAlpha2Country.IT')})`, value: 'iliad#IT'},
            {name: `Infostrada (${t('isoAlpha2Country.IT')})`, value: 'infostrada#IT'},
            {name: `Tiscali (${t('isoAlpha2Country.IT')})`, value: 'tiscali#IT'},
            {name: `Messagenet (${t('isoAlpha2Country.IT')})`, value: 'messagenet#IT'},
            {name: `Poste mobile (${t('isoAlpha2Country.IT')})`, value: 'poste_mobile#IT'},
            {name: `Ho Mobile (${t('isoAlpha2Country.IT')})`, value: 'ho_mobile#IT'},
            {name: `Very Mobile (${t('isoAlpha2Country.IT')})`, value: 'very_mobile#IT'},
            {name: `Auchan Mobile (${t('isoAlpha2Country.IT')})`, value: 'auchan_mobile#IT'},
            {name: `Kena Mobile (${t('isoAlpha2Country.IT')})`, value: 'kena_mobile#IT'},
            {name: `Lyca Mobile (${t('isoAlpha2Country.IT')})`, value: 'lyca_mobile#IT'},
            {name: `Rabona Mobile (${t('isoAlpha2Country.IT')})`, value: 'rabona_mobile#IT'},
            {name: `Feder Mobile (${t('isoAlpha2Country.IT')})`, value: 'feder_mobile#IT'},
            {name: `Ringo Mobile (${t('isoAlpha2Country.IT')})`, value: 'ringo_mobile#IT'},
            {name: `Erg Mobile (${t('isoAlpha2Country.IT')})`, value: 'erg_mobile#IT'},
            {name: `Noitel (${t('isoAlpha2Country.IT')})`, value: 'noitel#IT'},
            {name: `Noverca (${t('isoAlpha2Country.IT')})`, value: 'noverca#IT'},
            {name: `Uno Mobile Carrefour (${t('isoAlpha2Country.IT')})`, value: 'uno_mobile_carrefour#IT'},
            {name: `Visitel (${t('isoAlpha2Country.IT')})`, value: 'visitel#IT'},
            {name: `CoopVoce (${t('isoAlpha2Country.IT')})`, value: 'coopvoce#IT'},
            {name: `Vodafone (${t('isoAlpha2Country.GB')})`, value: 'vodafone#GB'},
            {name: `Tesco mobile (${t('isoAlpha2Country.GB')})`, value: 'tesco_mobile#GB'},
            {name: `EE  Limited (${t('isoAlpha2Country.GB')})`, value: 'ee_limited#GB'},
            {name: `Giff Gaff (${t('isoAlpha2Country.GB')})`, value: 'giff_gaff#GB'},
            {name: `Three (${t('isoAlpha2Country.GB')})`, value: 'three#GB'},
            {name: `Sky (${t('isoAlpha2Country.GB')})`, value: 'sky#GB'},
            {name: `BT Mobile (${t('isoAlpha2Country.GB')})`, value: 'bt_mobile#GB'},
            {name: `Virgin Mobile (${t('isoAlpha2Country.GB')})`, value: 'virgin_mobile#GB'},
            {name: `Asda Mobile (${t('isoAlpha2Country.GB')})`, value: 'asda_mobile#GB'},
            {name: `1Pmobile Limited (${t('isoAlpha2Country.GB')})`, value: '1pmobile_limited_mobile#GB'},
            {name: `Verizon (${t('isoAlpha2Country.US')})`, value: 'verizon#US'},
            {name: `AT&T (${t('isoAlpha2Country.US')})`, value: 'at&t#US'},
            {name: `T-Mobile (${t('isoAlpha2Country.US')})`, value: 't_mobile#US'},
            {name: `Boost Mobile (${t('isoAlpha2Country.US')})`, value: 'boost_mobile#US'},
            {name: `Consumer Celllular (${t('isoAlpha2Country.US')})`, value: 'consumer_cellular#US'},
            {name: `Repubblic Wireless (${t('isoAlpha2Country.US')})`, value: 'republic_wireless#US'},
            {name: `U.S. Cellular (${t('isoAlpha2Country.US')})`, value: 'us_cellular#US'},
            {name: `Red Pocket (${t('isoAlpha2Country.US')})`, value: 'red_pocket#US'},
            {name: `Spring (${t('isoAlpha2Country.US')})`, value: 'sprint#US'},
            {name: `Cricket Wireless (${t('isoAlpha2Country.US')})`, value: 'cricket_wireless#US'},
            {name: `Straight Talk (${t('isoAlpha2Country.US')})`, value: 'straight_talk#US'},
            {name: `Visible (${t('isoAlpha2Country.US')})`, value: 'visible#US'},
            {name: `H2O Wireless (${t('isoAlpha2Country.US')})`, value: 'h2o_wireless#US'},
            {name: `Thing (${t('isoAlpha2Country.US')})`, value: 'thing#US'},
            {name: `Spectrum (${t('isoAlpha2Country.US')})`, value: 'spectrum#US'},
            {name: `Google Fi (${t('isoAlpha2Country.US')})`, value: 'google_fi#US'},
            {name: `Metro by T-Mobile (${t('isoAlpha2Country.US')})`, value: 'metro_by_t_mobile#US'},
            {name: `Affinity Cellular (${t('isoAlpha2Country.US')})`, value: 'affinity_cellular#US'},
            {name: `Mint Mobile (${t('isoAlpha2Country.US')})`, value: 'mint_mobile#US'},
            {name: `Simple Mobile (${t('isoAlpha2Country.US')})`, value: 'simple_mobile#US'},
            {name: `Tracfone (${t('isoAlpha2Country.US')})`, value: 'tracfone#US'},
            /*
            {name: `Lebara (${t('isoAlpha2Country.DE')})`, value: 'lebara#DE'},
            {name: `Vodafone (${t('isoAlpha2Country.DE')})`, value: 'vodafone#DE'},
            {name: `O2 (${t('isoAlpha2Country.DE')})`, value: 'o2#DE'},
            {name: `Blau (${t('isoAlpha2Country.DE')})`, value: 'blau#DE'},
            {name: `Telekom (${t('isoAlpha2Country.DE')})`, value: 'telekom#DE'},
            {name: `1&1 (${t('isoAlpha2Country.DE')})`, value: '1&1#DE'},
            */
            {name: `Smartmobil.de (${t('isoAlpha2Country.DE')})`, value: 'smartmobil.de#DE'},
            {name: `${t('utils.phonecompanies.other')} (${t('isoAlpha2Country.IT')})` , value: 'other#IT'},
            {name: `${t('utils.phonecompanies.other')} (${t('isoAlpha2Country.US')})` , value: 'other#US'},
            //{name: `${t('utils.phonecompanies.other')} (${t('isoAlpha2Country.DE')})` , value: 'other#DE'},
            {name: `${t('utils.phonecompanies.other')} (${t('isoAlpha2Country.GB')})` , value: 'other#GB'}
        ]
        return oplist;
    }

}